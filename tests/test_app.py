"""End-to-end API tests against isolated databases; never touch the demo's data."""
import sqlite3
import tempfile
import threading
import unittest
from contextlib import closing
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

from app import create_app


class TidyTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.database = str(Path(self.directory.name) / "test.db")
        self.clock = patch("app.now", return_value=datetime(2026, 10, 28, 9, 0))
        self.clock.start()
        self.config = {"TESTING": True, "DATABASE": self.database, "SECRET_KEY": "test-only"}
        self.app = create_app(self.config)
        self.client = self.app.test_client()
        self.csrf = {}

    def tearDown(self):
        self.clock.stop()
        self.directory.cleanup()

    def token(self, client):
        return client.get("/api/session").json["csrf_token"]

    def post(self, path, data, client=None):
        client = client or self.client
        return client.post(path, json=data, headers={"X-CSRF-Token": self.token(client)})

    def login(self, email="pradyun@vit.ac.in", role="student", client=None):
        result = self.post("/api/login", {"email": email, "password": "pass123", "role": role}, client)
        self.assertEqual(result.status_code, 200, result.json)
        return result

    def dashboard(self, client=None):
        return (client or self.client).get("/api/dashboard").json

    def book(self, client=None, **overrides):
        return self.post("/api/book", {"type_id": 1, "scheduled_start_time": "2026-10-28T09:30:00", **overrides}, client)

    def register(self, client=None, **overrides):
        return self.post("/api/register", {"name": "Test Resident", "email": "resident@vit.ac.in", "reg_no": "24BCE9999", "password": "testpass123", "block_id": 1, "room_number": 305, **overrides}, client)

    def test_home_assets_and_security_headers(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Tidy", response.data)
        self.assertIn("frame-ancestors 'none'", response.headers["Content-Security-Policy"])
        response.close()
        for asset in ("app.js", "style.css", "components.css", "favicon.svg"):
            with self.client.get("/static/" + asset) as asset_response:
                self.assertEqual(asset_response.status_code, 200)
        self.assertEqual(self.client.get("/app.py").status_code, 404)
        self.assertEqual(self.client.get("/.session-key").status_code, 404)

    def test_csrf_and_auth_are_required(self):
        self.assertEqual(self.client.get("/api/dashboard").status_code, 401)
        self.assertEqual(self.client.post("/api/login", json={}).status_code, 403)
        self.assertEqual(self.post("/api/login", {"email": "pradyun@vit.ac.in", "password": "wrong"}).status_code, 401)
        self.login()
        self.assertEqual(self.client.get("/api/staff/dashboard").status_code, 403)
        self.assertNotIn("password_hash", str(self.dashboard()))
        self.post("/api/logout", {})
        self.assertFalse(self.client.get("/api/session").json["logged_in"])

    def test_book_deducts_once_and_assigns_in_block(self):
        self.login()
        result = self.book(notes="Please clear the corner.")
        self.assertEqual(result.status_code, 201, result.json)
        data = self.dashboard()
        self.assertEqual(data["room"]["room_balance"], 450)
        self.assertEqual(data["bookings"][0]["notes"], "Please clear the corner.")
        self.assertEqual(data["bookings"][0]["status"], "Assigned")
        self.assertTrue(data["bookings"][0]["events"])
        self.assertEqual(sum(t["amount"] for t in data["transactions"]), data["room"]["room_balance"])
        self.assertEqual(self.book().status_code, 409)
        self.assertEqual(self.dashboard()["room"]["room_balance"], 450)

    def test_roommates_share_bookings_and_cancel_refunds_once(self):
        self.login()
        booking_id = self.book().json["booking_id"]
        roommate = self.app.test_client()
        self.login("bhuvan@vit.ac.in", client=roommate)
        self.assertEqual(len(self.dashboard(roommate)["bookings"]), 1)
        result = self.post("/api/cancel", {"booking_id": booking_id}, roommate)
        self.assertEqual(result.status_code, 200, result.json)
        self.assertEqual(self.dashboard()["room"]["room_balance"], 500)
        self.assertEqual(self.post("/api/cancel", {"booking_id": booking_id}).status_code, 409)
        self.assertEqual(self.dashboard()["room"]["room_balance"], 500)

    def test_other_room_cannot_see_cancel_or_rate_request(self):
        self.login()
        booking_id = self.book().json["booking_id"]
        stranger = self.app.test_client()
        self.assertEqual(self.register(stranger).status_code, 201)
        self.assertEqual(self.dashboard(stranger)["bookings"], [])
        self.assertEqual(self.post("/api/cancel", {"booking_id": booking_id}, stranger).status_code, 404)
        self.assertEqual(self.post(f"/api/bookings/{booking_id}/feedback", {"rating": 5}, stranger).status_code, 404)
        self.assertEqual(self.dashboard()["room"]["room_balance"], 450)

    def test_availability_matches_booked_room_and_duration(self):
        self.login()
        self.assertEqual(self.book(type_id=2).status_code, 201)
        result = self.client.get("/api/availability?type_id=1&date=2026-10-28")
        slots = {s["time"]: s["available"] for s in result.json["slots"]}
        self.assertFalse(slots["09:00"])
        self.assertFalse(slots["09:30"])
        self.assertFalse(slots["10:00"])
        self.assertTrue(slots["10:30"])

    def test_invalid_times_and_unknown_services_do_not_charge(self):
        self.login()
        for start in ("bad", "2026-10-27T10:00:00", "2026-10-28T09:00:00", "2026-10-28T09:31:00", "2026-10-28T17:30:00", "2026-11-12T10:00:00", "2026-10-28T10:00:00+05:30"):
            self.assertEqual(self.book(type_id=2, scheduled_start_time=start).status_code, 400, start)
        self.assertEqual(self.book(type_id=999).status_code, 400)
        self.assertEqual(self.book(cleaner_id=999).status_code, 409)
        self.assertEqual(self.dashboard()["room"]["room_balance"], 500)

    def test_no_cross_block_cleaner_assignment(self):
        self.login()
        with closing(sqlite3.connect(self.database)) as conn:
            cleaner = conn.execute("SELECT cleaner_id FROM cleaner WHERE block_id=2 LIMIT 1").fetchone()[0]
        self.assertEqual(self.book(cleaner_id=cleaner).status_code, 409)

    def test_registration_and_private_room_join(self):
        first = self.app.test_client()
        self.assertEqual(self.register(first).status_code, 201)
        room = self.dashboard(first)["room"]
        self.assertEqual(room["room_balance"], 0)
        other = self.app.test_client()
        values = {"email": "another@vit.ac.in", "reg_no": "24BCE9998"}
        self.assertEqual(self.register(other, **values).status_code, 400)
        self.assertEqual(self.register(other, join_code="à", **values).status_code, 400)
        self.assertEqual(self.register(other, join_code=room["join_code"], **values).status_code, 201)
        self.assertEqual(len(self.dashboard(first)["roommates"]), 2)
        self.assertEqual(self.post("/api/wallet/topup", {"amount": 100}, first).status_code, 200)
        self.assertEqual(self.dashboard(other)["room"]["room_balance"], 100)

    def test_registration_validation(self):
        for bad in ({"email": "person@example.com"}, {"reg_no": "bad"}, {"password": "short"}, {"room_number": -2}, {"block_id": 987}):
            self.assertEqual(self.register(**bad).status_code, 400, bad)
        self.assertEqual(self.register(email="resident@vitstudent.ac.in").status_code, 201)
        self.post("/api/logout", {})
        self.assertEqual(self.register().status_code, 409)

    def test_wallet_demo_credit_validation_and_insufficient_funds(self):
        self.assertEqual(self.register().status_code, 201)
        self.assertEqual(self.book().status_code, 409)
        for amount in (0, -1, 99, 100.5, True, "invalid"):
            self.assertEqual(self.post("/api/wallet/topup", {"amount": amount}).status_code, 400)
        self.assertEqual(self.post("/api/wallet/topup", {"amount": 100}).status_code, 200)
        self.assertEqual(self.book().status_code, 201)
        self.assertEqual(self.dashboard()["room"]["room_balance"], 50)

    def test_staff_workflow_rating_and_permissions(self):
        self.login()
        booking_id = self.book().json["booking_id"]
        staff = self.app.test_client()
        self.login("staff@vit.ac.in", "staff", staff)
        path = f"/api/staff/bookings/{booking_id}/status"
        self.assertEqual(self.post(path, {"status": "Completed"}).status_code, 403)
        self.assertEqual(self.post(path, {"status": "Completed"}, staff).status_code, 409)
        self.assertEqual(self.post(path, {"status": "In Progress"}, staff).status_code, 409)
        with patch("app.now", return_value=datetime(2026, 10, 28, 9, 20)):
            self.assertEqual(self.post(path, {"status": "In Progress"}, staff).status_code, 200)
            self.assertEqual(self.post("/api/cancel", {"booking_id": booking_id}).status_code, 409)
            self.assertEqual(self.post(path, {"status": "Completed"}, staff).status_code, 200)
        feedback_path = f"/api/bookings/{booking_id}/feedback"
        self.assertEqual(self.post(feedback_path, {"rating": 5, "feedback": "Lovely clean."}).status_code, 200)
        self.assertEqual(self.post(feedback_path, {"rating": 3}).status_code, 409)
        self.assertEqual(self.dashboard()["bookings"][0]["rating"], 5)
        self.assertEqual(len(self.dashboard()["bookings"][0]["events"]), 4)

    def test_cancel_cutoff_and_staff_refund(self):
        self.login()
        booking_id = self.book().json["booking_id"]
        with patch("app.now", return_value=datetime(2026, 10, 28, 9, 26)):
            self.assertFalse(self.dashboard()["bookings"][0]["can_cancel"])
            self.assertEqual(self.post("/api/cancel", {"booking_id": booking_id}).status_code, 409)
        staff = self.app.test_client()
        self.login("staff@vit.ac.in", "staff", staff)
        path = f"/api/staff/bookings/{booking_id}/status"
        self.assertEqual(self.post(path, {"status": "Cancelled"}, staff).status_code, 200)
        self.assertEqual(self.post(path, {"status": "Cancelled"}, staff).status_code, 409)
        self.assertEqual(self.dashboard()["room"]["room_balance"], 500)

    def test_two_room_requests_for_same_cleaner_conflict(self):
        self.login()
        self.assertEqual(self.book(cleaner_id=1).status_code, 201)
        other = self.app.test_client()
        self.register(other)
        self.post("/api/wallet/topup", {"amount": 100}, other)
        self.assertEqual(self.book(other, cleaner_id=1).status_code, 409)
        self.assertEqual(self.book(other).status_code, 201)
        self.assertEqual(self.dashboard(other)["bookings"][0]["cleaner_id"], 2)

    def test_concurrent_room_bookings_cannot_double_charge(self):
        clients = [self.app.test_client(), self.app.test_client()]
        self.login(client=clients[0])
        self.login("bhuvan@vit.ac.in", client=clients[1])
        barrier = threading.Barrier(2)
        tokens = [self.token(client) for client in clients]

        def submit(index):
            barrier.wait()
            return clients[index].post("/api/book", json={"type_id": 1, "scheduled_start_time": "2026-10-28T09:30:00"}, headers={"X-CSRF-Token": tokens[index]}).status_code

        with ThreadPoolExecutor(max_workers=2) as pool:
            statuses = sorted(pool.map(submit, range(2)))
        self.assertEqual(statuses, [201, 409])
        self.assertEqual(self.dashboard(clients[0])["room"]["room_balance"], 450)
        self.assertEqual(len(self.dashboard(clients[0])["bookings"]), 1)

    def test_persistence_and_initialization_are_idempotent(self):
        self.login()
        self.book()
        self.post("/api/wallet/topup", {"amount": 250})
        restarted = create_app(self.config)
        client = restarted.test_client()
        self.login(client=client)
        data = self.dashboard(client)
        self.assertEqual(data["room"]["room_balance"], 700)
        self.assertEqual(len(data["transactions"]), 3)
        self.assertEqual(len(data["bookings"]), 1)

    def test_original_database_schema_is_migrated(self):
        legacy_path = str(Path(self.directory.name) / "legacy.db")
        with closing(sqlite3.connect(legacy_path)) as conn:
            conn.executescript("""
                CREATE TABLE block(block_id INTEGER PRIMARY KEY,block_name TEXT UNIQUE NOT NULL);
                INSERT INTO block VALUES(1,'T-Block');
                CREATE TABLE room(room_id INTEGER PRIMARY KEY,block_id INTEGER,room_number INTEGER,floor INTEGER,beds INTEGER,room_status TEXT,room_balance REAL,UNIQUE(block_id,room_number));
                INSERT INTO room VALUES(1,1,204,2,4,'Available',321);
                CREATE TABLE student(reg_no TEXT PRIMARY KEY,name TEXT,email TEXT UNIQUE,password_hash TEXT,phone TEXT,room_id INTEGER);
                INSERT INTO student VALUES('24BDS0052','Pradyun Shashi','pradyun@vit.ac.in','pass123','',1);
                CREATE TABLE booking(booking_id INTEGER PRIMARY KEY,reg_no TEXT,type_id INTEGER,cleaner_id INTEGER,request_date TEXT,priority TEXT,scheduled_start_time TEXT,amount_charged REAL,status TEXT);
            """)
        legacy = create_app({**self.config, "DATABASE": legacy_path}).test_client()
        self.login(client=legacy)
        self.assertEqual(self.dashboard(legacy)["room"]["room_balance"], 321)
        with closing(sqlite3.connect(legacy_path)) as conn:
            self.assertTrue(conn.execute("SELECT password_hash FROM student").fetchone()[0].startswith("scrypt:"))

    def test_missing_legacy_room_returns_helpful_error_on_all_student_routes(self):
        self.login()
        with closing(sqlite3.connect(self.database)) as conn:
            conn.execute("UPDATE student SET room_id=NULL WHERE reg_no='24BDS0052'")
            conn.commit()
        self.assertEqual(self.client.get("/api/dashboard").status_code, 404)
        self.assertEqual(self.client.get("/api/availability?type_id=1&date=2026-10-28").status_code, 404)
        for path, data in (("/api/book", {}), ("/api/cancel", {}), ("/api/wallet/topup", {"amount": 100}), ("/api/bookings/1/feedback", {"rating": 5})):
            self.assertEqual(self.post(path, data).status_code, 404, path)

    def test_null_legacy_invite_code_cannot_be_used_to_join(self):
        with closing(sqlite3.connect(self.database)) as conn:
            conn.execute("UPDATE room SET join_code=NULL")
            conn.commit()
        self.assertEqual(self.register(room_number=204).status_code, 400)

    def test_staff_start_readiness_uses_server_clock(self):
        self.login()
        self.book()
        self.assertFalse(self.dashboard()["bookings"][0]["can_start"])
        with patch("app.now", return_value=datetime(2026, 10, 28, 9, 15)):
            self.assertTrue(self.dashboard()["bookings"][0]["can_start"])
        with patch("app.now", return_value=datetime(2026, 10, 29, 9, 15)):
            self.assertFalse(self.dashboard()["bookings"][0]["can_start"])

    def test_concurrent_refunds_cannot_credit_wallet_twice(self):
        clients = [self.app.test_client(), self.app.test_client()]
        self.login(client=clients[0])
        self.login("bhuvan@vit.ac.in", client=clients[1])
        booking_id = self.book(clients[0]).json["booking_id"]
        tokens = [self.token(client) for client in clients]
        barrier = threading.Barrier(2)

        def cancel(index):
            barrier.wait()
            return clients[index].post("/api/cancel", json={"booking_id": booking_id}, headers={"X-CSRF-Token": tokens[index]}).status_code

        with ThreadPoolExecutor(max_workers=2) as pool:
            self.assertEqual(sorted(pool.map(cancel, range(2))), [200, 409])
        data = self.dashboard(clients[0])
        self.assertEqual(data["room"]["room_balance"], 500)
        self.assertEqual(sum(t["amount"] for t in data["transactions"]), 500)

    def test_database_demo_is_staff_only_and_hides_credentials(self):
        self.assertEqual(self.client.get('/api/staff/database').status_code, 401)
        self.login()
        self.assertEqual(self.client.get('/api/staff/database').status_code, 403)
        staff = self.app.test_client()
        self.login('staff@vit.ac.in', 'staff', staff)
        data = staff.get('/api/staff/database').json
        self.assertEqual(data['checks'], {'integrity': 'ok', 'foreign_key_violations': 0, 'wallet_mismatches': 0})
        self.assertEqual(data['total'], 3)
        self.assertNotIn('password_hash', data['columns'])
        self.assertNotIn('scrypt:', str(data))
        self.assertNotIn('pass123', str(data))
        for table in data['tables']:
            response = staff.get('/api/staff/database?table=' + table['key'])
            self.assertEqual(response.status_code, 200)
            self.assertIn('LIMIT ? OFFSET ?', response.json['sql'])
            self.assertEqual(response.json['total'], table['count'])
            self.assertNotIn('join_code', response.json['columns'])

    def test_database_demo_validates_table_and_pagination(self):
        self.login('staff@vit.ac.in', 'staff')
        for query in ('table=unknown', 'table=student;DROP%20TABLE%20room', 'page=-1', 'page=invalid'):
            self.assertEqual(self.client.get('/api/staff/database?' + query).status_code, 400)
        self.assertEqual(self.client.get('/api/staff/database?page=999999').json['page'], 1)

    def test_staff_presentation_action_is_explicit_and_audited(self):
        self.login()
        booking_id = self.book(scheduled_start_time='2026-10-29T10:00:00').json['booking_id']
        path = f'/api/staff/bookings/{booking_id}/status'
        self.assertEqual(self.post(path, {'status': 'In Progress', 'demo_override': True}).status_code, 403)
        staff = self.app.test_client()
        self.login('staff@vit.ac.in', 'staff', staff)
        self.assertEqual(self.post(path, {'status': 'In Progress'}, staff).status_code, 409)
        self.assertEqual(self.post(path, {'status': 'In Progress', 'demo_override': True}, staff).status_code, 200)
        self.assertIn('presentation demo', self.dashboard()['bookings'][0]['events'][-1]['note'])
        self.assertEqual(self.post(path, {'status': 'Completed'}, staff).status_code, 200)
        self.assertEqual(self.dashboard()['bookings'][0]['status'], 'Completed')

    def test_presentation_override_can_be_disabled(self):
        self.app.config['DEMO_MODE'] = False
        self.login()
        booking_id = self.book(scheduled_start_time='2026-10-29T10:00:00').json['booking_id']
        staff = self.app.test_client()
        self.login('staff@vit.ac.in', 'staff', staff)
        self.assertFalse(staff.get('/api/staff/dashboard').json['demo_mode'])
        self.assertEqual(self.post(f'/api/staff/bookings/{booking_id}/status', {'status': 'In Progress', 'demo_override': True}, staff).status_code, 409)

    def test_full_database_presentation_flow_commits_real_rows_and_survives_restart(self):
        def sql_one(query, values=()):
            # Each assertion opens a separate connection, so uncommitted/cached data cannot pass.
            with closing(sqlite3.connect(self.database)) as connection:
                connection.row_factory = sqlite3.Row
                return dict(connection.execute(query, values).fetchone())

        self.assertEqual(self.register().status_code, 201)
        student = sql_one('SELECT reg_no,name,email,room_id FROM student WHERE reg_no=?', ('24BCE9999',))
        room_id = student['room_id']
        self.assertEqual(sql_one('SELECT room_number,room_balance FROM room WHERE room_id=?', (room_id,)), {'room_number': 305, 'room_balance': 0})
        self.assertEqual(self.post('/api/wallet/topup', {'amount': 250}).status_code, 200)
        self.assertEqual(sql_one('SELECT room_balance FROM room WHERE room_id=?', (room_id,))['room_balance'], 250)
        booking = self.book(type_id=2)
        self.assertEqual(booking.status_code, 201)
        booking_id = booking.json['booking_id']
        bill = sql_one('SELECT charged,refunded,net_charge FROM v_room_billing WHERE booking_id=?', (booking_id,))
        self.assertEqual(bill, {'charged': 150, 'refunded': 0, 'net_charge': 150})
        self.assertEqual(sql_one('SELECT room_balance FROM room WHERE room_id=?', (room_id,))['room_balance'], 100)
        self.assertEqual(sql_one('SELECT balance_after FROM v_room_statement WHERE room_id=? ORDER BY transaction_id DESC LIMIT 1', (room_id,))['balance_after'], 100)
        self.assertEqual(self.post('/api/cancel', {'booking_id': booking_id}).status_code, 200)
        self.assertEqual(sql_one('SELECT charged,refunded,net_charge FROM v_room_billing WHERE booking_id=?', (booking_id,)), {'charged': 150, 'refunded': 150, 'net_charge': 0})
        self.assertEqual(sql_one('SELECT room_balance FROM room WHERE room_id=?', (room_id,))['room_balance'], 250)
        self.assertEqual(sql_one('SELECT count(*) AS entries FROM wallet_transaction WHERE room_id=?', (room_id,))['entries'], 3)
        self.assertEqual(sql_one('SELECT count(*) AS events FROM booking_event WHERE booking_id=?', (booking_id,))['events'], 2)

        restarted = create_app(self.config)
        client = restarted.test_client()
        result = self.post('/api/login', {'email': 'resident@vit.ac.in', 'password': 'testpass123'}, client)
        self.assertEqual(result.status_code, 200)
        dashboard = self.dashboard(client)
        self.assertEqual(dashboard['room']['room_balance'], 250)
        self.assertEqual(dashboard['bookings'][0]['status'], 'Cancelled')
        self.assertEqual(len(dashboard['transactions']), 3)
        staff = restarted.test_client()
        self.login('staff@vit.ac.in', 'staff', staff)
        self.assertEqual(staff.get('/api/staff/database?table=student').json['total'], 4)
        self.assertEqual(staff.get('/api/staff/database?table=room').json['total'], 2)
        self.assertEqual(staff.get('/api/staff/database?table=billing').json['rows'][0]['net_charge'], 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
