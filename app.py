"""Tidy: persistent, local hostel room care. Start with python app.py."""
import os
import re
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path

from flask import Flask, g, jsonify, request, send_from_directory, session
from werkzeug.security import check_password_hash, generate_password_hash

ROOT = Path(__file__).resolve().parent
IST = timezone(timedelta(hours=5, minutes=30))


def now():
    return datetime.now(IST).replace(tzinfo=None, microsecond=0)


def stamp(value=None):
    return (value or now()).isoformat(timespec="seconds")


def create_app(test_config=None):
    app = Flask(__name__, static_folder="static")
    app.config.update(DATABASE=str(ROOT / "hostel_cleaning.db"), SESSION_COOKIE_HTTPONLY=True,
                      SESSION_COOKIE_SAMESITE="Lax", PERMANENT_SESSION_LIFETIME=timedelta(days=7),
                      MAX_CONTENT_LENGTH=32768, DEMO_MODE=os.environ.get("TIDY_DEMO_MODE", "1") == "1")
    if test_config:
        app.config.update(test_config)
    if not app.config.get("SECRET_KEY"):
        key_file = ROOT / ".session-key"
        if not key_file.exists():
            try:
                with key_file.open("x", encoding="utf-8") as handle:
                    handle.write(secrets.token_hex(32))
            except FileExistsError:
                pass
        app.config["SECRET_KEY"] = os.environ.get("TIDY_SECRET_KEY") or key_file.read_text().strip()

    def db():
        if "db" not in g:
            g.db = sqlite3.connect(app.config["DATABASE"], timeout=15)
            g.db.row_factory = sqlite3.Row
            g.db.execute("PRAGMA foreign_keys=ON")
        return g.db

    @app.teardown_appcontext
    def close_db(_error):
        connection = g.pop("db", None)
        if connection is not None:
            connection.close()

    def fail(message, status=400):
        return jsonify(success=False, message=message), status

    def payload():
        data = request.get_json(silent=True)
        return data if isinstance(data, dict) else {}

    def text(data, key, limit=200):
        value = data.get(key, "")
        return value.strip()[:limit] if isinstance(value, str) else ""

    def integer(value):
        if isinstance(value, bool) or isinstance(value, float):
            return None
        try:
            return int(value)
        except (TypeError, ValueError, OverflowError):
            return None

    def auth(role):
        def decorate(fn):
            @wraps(fn)
            def wrapped(*args, **kwargs):
                if not session.get("identity"):
                    return fail("Please sign in to continue.", 401)
                if session.get("role") != role:
                    return fail("You don’t have access to this action.", 403)
                if role == "student" and not student_room():
                    return fail("Your room could not be found. Contact the hostel desk.", 404)
                return fn(*args, **kwargs)
            return wrapped
        return decorate

    @app.before_request
    def protect_requests():
        if request.path.startswith("/api/") and request.method in ("POST", "PATCH", "DELETE"):
            token = session.get("csrf_token")
            if not token or not secrets.compare_digest(request.headers.get("X-CSRF-Token", "").encode(), token.encode()):
                return fail("Your session needs a refresh. Reload the page and try again.", 403)

    @app.after_request
    def headers(response):
        response.headers.update({"X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin", "X-Frame-Options": "DENY"})
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; "
            "font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
        if request.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.errorhandler(404)
    def missing(_error):
        return fail("That page or record could not be found.", 404)

    @app.errorhandler(413)
    def too_large(_error):
        return fail("That request is too large.", 413)

    @app.errorhandler(sqlite3.OperationalError)
    def database_error(error):
        app.logger.error("Database operation failed: %s", error)
        return fail("The room desk is busy. Please try again in a moment.", 503)

    @app.route("/")
    def home():
        return send_from_directory(ROOT, "index.html")

    def user_info():
        if session.get("role") == "staff":
            row = db().execute("SELECT staff_id,name,email FROM staff WHERE staff_id=?", (session["identity"],)).fetchone()
            return {**dict(row), "role": "staff"} if row else None
        row = db().execute(
            "SELECT s.reg_no,s.name,s.email,s.room_id,r.room_number,b.block_name FROM student s "
            "JOIN room r ON r.room_id=s.room_id JOIN block b ON b.block_id=r.block_id WHERE s.reg_no=?",
            (session.get("identity"),)).fetchone()
        return {**dict(row), "role": "student"} if row else None

    @app.get("/api/session")
    def get_session():
        session.setdefault("csrf_token", secrets.token_hex(32))
        user = user_info() if session.get("identity") else None
        return jsonify(logged_in=bool(user), user=user, csrf_token=session["csrf_token"], server_time=stamp())

    @app.post("/api/login")
    def login():
        data = payload()
        role = "staff" if data.get("role") == "staff" else "student"
        table = "staff" if role == "staff" else "student"
        row = db().execute(f"SELECT * FROM {table} WHERE lower(email)=?", (text(data, "email").lower(),)).fetchone()
        if not row or not check_password_hash(row["password_hash"], text(data, "password", 256)):
            return fail("That email and password don’t match. Please try again.", 401)
        session.clear()
        session.update(identity=row["staff_id"] if role == "staff" else row["reg_no"], role=role, csrf_token=secrets.token_hex(32))
        session.permanent = True
        return jsonify(success=True, user=user_info(), csrf_token=session["csrf_token"])

    @app.post("/api/logout")
    def logout():
        session.clear()
        session["csrf_token"] = secrets.token_hex(32)
        return jsonify(success=True, csrf_token=session["csrf_token"])

    @app.get("/api/blocks")
    def blocks():
        return jsonify(blocks=[dict(r) for r in db().execute("SELECT * FROM block ORDER BY block_name")])

    @app.post("/api/register")
    def register():
        data = payload()
        name, email = text(data, "name", 70), text(data, "email").lower()
        password, reg_no = text(data, "password", 256), text(data, "reg_no", 20).upper()
        room_number, block_id = integer(data.get("room_number")), integer(data.get("block_id"))
        if len(name) < 2 or not re.fullmatch(r"[A-Z0-9]{6,15}", reg_no):
            return fail("Enter your name and a registration number with 6–15 letters or numbers.")
        if not re.fullmatch(r"[^\s@]+@(?:[a-z0-9-]+\.)*(?:vit|vitstudent)\.ac\.in", email):
            return fail("Use a VIT email address ending in vit.ac.in or vitstudent.ac.in.")
        if len(password) < 8:
            return fail("Choose a password with at least 8 characters.")
        if not room_number or not 1 <= room_number <= 9999 or not block_id:
            return fail("Choose your block and a room number from 1 to 9999.")
        connection = db()
        try:
            connection.execute("BEGIN IMMEDIATE")
            if connection.execute("SELECT 1 FROM student WHERE reg_no=? OR lower(email)=?", (reg_no, email)).fetchone():
                return fail("That registration number or email is already registered.", 409)
            if not connection.execute("SELECT 1 FROM block WHERE block_id=?", (block_id,)).fetchone():
                return fail("Choose an existing hostel block.")
            room = connection.execute("SELECT * FROM room WHERE block_id=? AND room_number=?", (block_id, room_number)).fetchone()
            if room:
                stored_code = (room["join_code"] or "").strip().upper()
                if not stored_code or not secrets.compare_digest(text(data, "join_code", 30).upper().encode(), stored_code.encode()):
                    return fail("This room is registered. Ask a roommate for the room code on their My room page.")
                count = connection.execute("SELECT count(*) FROM student WHERE room_id=?", (room["room_id"],)).fetchone()[0]
                if count >= (room["beds"] or 6):
                    return fail("This room is full. Check your room number or contact the hostel desk.")
                room_id = room["room_id"]
            else:
                room_id = connection.execute(
                    "INSERT INTO room(block_id,room_number,floor,beds,room_balance,join_code) VALUES(?,?,?,?,0,?)",
                    (block_id, room_number, room_number // 100, 4, secrets.token_hex(3).upper())).lastrowid
            connection.execute("INSERT INTO student(reg_no,name,email,password_hash,room_id) VALUES(?,?,?,?,?)",
                               (reg_no, name, email, generate_password_hash(password), room_id))
            connection.commit()
        except sqlite3.IntegrityError:
            connection.rollback()
            return fail("That registration number or email is already registered.", 409)
        session.clear()
        session.update(identity=reg_no, role="student", csrf_token=secrets.token_hex(32))
        session.permanent = True
        return jsonify(success=True, user=user_info(), csrf_token=session["csrf_token"]), 201

    def student_room():
        return db().execute("SELECT r.*,b.block_name FROM student s JOIN room r ON r.room_id=s.room_id "
                            "JOIN block b ON b.block_id=r.block_id WHERE s.reg_no=?", (session["identity"],)).fetchone()

    def event(booking_id, status, note):
        db().execute("INSERT INTO booking_event(booking_id,status,note,created_at) VALUES(?,?,?,?)", (booking_id, status, note, stamp()))

    def get_bookings(room_id=None):
        sql = """SELECT b.*,ct.type_name,ct.duration,c.name AS cleaner_name,s.name AS student_name,
                 r.room_number,bl.block_name FROM booking b JOIN cleaning_type ct ON ct.type_id=b.type_id
                 JOIN student s ON s.reg_no=b.reg_no LEFT JOIN cleaner c ON c.cleaner_id=b.cleaner_id
                 JOIN room r ON r.room_id=b.room_id JOIN block bl ON bl.block_id=r.block_id"""
        rows = db().execute(sql + (" WHERE b.room_id=?" if room_id else "") + " ORDER BY b.scheduled_start_time DESC,b.booking_id DESC",
                            (room_id,) if room_id else ()).fetchall()
        result = []
        for row in rows:
            item = dict(row)
            start = datetime.fromisoformat(item["scheduled_start_time"])
            current = now()
            item["can_cancel"] = item["status"] == "Assigned" and start - current >= timedelta(minutes=5)
            item["can_start"] = item["status"] == "Assigned" and start.date() == current.date() and start <= current + timedelta(minutes=15)
            item["events"] = [dict(e) for e in db().execute("SELECT status,created_at,note FROM booking_event WHERE booking_id=? ORDER BY event_id", (item["booking_id"],))]
            result.append(item)
        return result

    def service_list():
        return [dict(s) for s in db().execute("SELECT * FROM cleaning_type ORDER BY price")]

    @app.get("/api/dashboard")
    @auth("student")
    def dashboard():
        room = student_room()
        if not room:
            return fail("Your room could not be found. Contact the hostel desk.", 404)
        roommates = db().execute("SELECT reg_no,name FROM student WHERE room_id=? ORDER BY name", (room["room_id"],))
        transactions = db().execute("SELECT t.*,s.name AS student_name FROM wallet_transaction t LEFT JOIN student s ON s.reg_no=t.reg_no "
                                    "WHERE t.room_id=? ORDER BY t.transaction_id DESC LIMIT 100", (room["room_id"],))
        return jsonify(user=user_info(), room=dict(room), roommates=[dict(r) for r in roommates], services=service_list(),
                       bookings=get_bookings(room["room_id"]), transactions=[dict(t) for t in transactions], server_time=stamp(),
                       cleaners=[dict(c) for c in db().execute("SELECT cleaner_id,name,status FROM cleaner WHERE block_id=?", (room["block_id"],))])

    def service_by_id(value):
        return db().execute("SELECT * FROM cleaning_type WHERE type_id=?", (integer(value),)).fetchone()

    def available_cleaners(room, start, duration, preferred=None):
        end = start + timedelta(minutes=duration)
        busy = db().execute("SELECT b.cleaner_id,b.room_id,b.status,b.scheduled_start_time,ct.duration FROM booking b "
                            "JOIN cleaning_type ct ON ct.type_id=b.type_id WHERE b.status IN ('Assigned','In Progress')").fetchall()
        excluded = set()
        for b in busy:
            other_start = datetime.fromisoformat(b["scheduled_start_time"])
            overlap = start < other_start + timedelta(minutes=b["duration"]) and end > other_start
            overdue = b["status"] == "In Progress" and start.date() == now().date() and start <= now() + timedelta(minutes=30)
            if overlap or overdue:
                if b["room_id"] == room["room_id"]:
                    return []
                excluded.add(b["cleaner_id"])
        cleaners = db().execute("SELECT cleaner_id,name FROM cleaner WHERE block_id=? AND status='Available' ORDER BY cleaner_id", (room["block_id"],))
        return [dict(c) for c in cleaners if c["cleaner_id"] not in excluded and (not preferred or c["cleaner_id"] == preferred)]

    def validate_start(raw, duration):
        try:
            start = datetime.fromisoformat(raw) if isinstance(raw, str) else None
        except ValueError:
            start = None
        if not start or start.tzinfo is not None:
            return None, "Choose a valid date and time (IST)."
        current = now()
        if start < current + timedelta(minutes=10):
            return None, "Choose a slot at least 10 minutes from now."
        if start.date() > current.date() + timedelta(days=14):
            return None, "Bookings open up to 14 days ahead."
        if start.minute not in (0, 30) or start.second or start.microsecond:
            return None, "Choose a half-hour slot, such as 10:00 or 10:30."
        if start.hour < 9 or start + timedelta(minutes=duration) > start.replace(hour=18, minute=0, second=0):
            return None, "Cleaning hours are 9:00 am–6:00 pm IST. Choose a slot that finishes by 6:00 pm."
        return start, None

    @app.get("/api/availability")
    @auth("student")
    def availability():
        service = service_by_id(request.args.get("type_id"))
        if not service:
            return fail("Choose a cleaning service first.")
        try:
            day = datetime.strptime(request.args.get("date", ""), "%Y-%m-%d")
        except ValueError:
            return fail("Choose a valid date.")
        if not now().date() <= day.date() <= now().date() + timedelta(days=14):
            return fail("Choose a date within the next 14 days.")
        room = student_room()
        slots = []
        for minute in range(9 * 60, 18 * 60, 30):
            start = day + timedelta(minutes=minute)
            _, error = validate_start(stamp(start), service["duration"])
            free = available_cleaners(room, start, service["duration"]) if not error else []
            slots.append({"time": start.strftime("%H:%M"), "available": bool(free), "cleaners": free})
        return jsonify(slots=slots, timezone="Asia/Kolkata")

    @app.post("/api/book")
    @auth("student")
    def book():
        data = payload()
        service = service_by_id(data.get("type_id"))
        if not service:
            return fail("Choose a valid cleaning service.")
        start, error = validate_start(data.get("scheduled_start_time"), service["duration"])
        if error:
            return fail(error)
        preferred = integer(data.get("cleaner_id"))
        if data.get("cleaner_id") and not preferred:
            return fail("Choose an available cleaner.")
        connection = db()
        try:
            connection.execute("BEGIN IMMEDIATE")
            room = student_room()
            if room["room_balance"] < service["price"]:
                return fail("Your room wallet needs a top-up before booking.", 409)
            free = available_cleaners(room, start, service["duration"], preferred)
            if not free:
                return fail("This slot is no longer available for your room or cleaner. Please choose another.", 409)
            cleaner = free[0]
            booking_id = connection.execute(
                "INSERT INTO booking(reg_no,room_id,type_id,cleaner_id,request_date,scheduled_start_time,amount_charged,status,notes) VALUES(?,?,?,?,?,?,?,'Assigned',?)",
                (session["identity"], room["room_id"], service["type_id"], cleaner["cleaner_id"], stamp(), stamp(start), service["price"], text(data, "notes", 500))).lastrowid
            connection.execute("UPDATE room SET room_balance=room_balance-? WHERE room_id=?", (service["price"], room["room_id"]))
            connection.execute("INSERT INTO wallet_transaction(room_id,reg_no,booking_id,amount,description,created_at) VALUES(?,?,?,?,?,?)",
                               (room["room_id"], session["identity"], booking_id, -service["price"], service["type_name"], stamp()))
            event(booking_id, "Assigned", f"Assigned to {cleaner['name']}")
            connection.commit()
            return jsonify(success=True, booking_id=booking_id, message="You’re booked. A fresher room is on its way."), 201
        except sqlite3.Error:
            connection.rollback()
            raise

    def refund(booking, note):
        connection = db()
        connection.execute("UPDATE booking SET status='Cancelled',cancelled_at=? WHERE booking_id=?", (stamp(), booking["booking_id"]))
        connection.execute("UPDATE room SET room_balance=room_balance+? WHERE room_id=?", (booking["amount_charged"], booking["room_id"]))
        connection.execute("INSERT INTO wallet_transaction(room_id,reg_no,booking_id,amount,description,created_at) VALUES(?,?,?,?,?,?)",
                           (booking["room_id"], booking["reg_no"], booking["booking_id"], booking["amount_charged"], "Cancellation refund", stamp()))
        event(booking["booking_id"], "Cancelled", note)

    @app.post("/api/cancel")
    @auth("student")
    def cancel():
        connection = db()
        connection.execute("BEGIN IMMEDIATE")
        room = student_room()
        booking = connection.execute("SELECT * FROM booking WHERE booking_id=? AND room_id=?", (integer(payload().get("booking_id")), room["room_id"])).fetchone()
        if not booking:
            return fail("That request could not be found in your room.", 404)
        if booking["status"] != "Assigned":
            return fail("Only upcoming, assigned requests can be cancelled.", 409)
        if datetime.fromisoformat(booking["scheduled_start_time"]) - now() < timedelta(minutes=5):
            return fail("Cancellations close 5 minutes before your slot.", 409)
        refund(booking, "Cancelled by a roommate. Full refund issued.")
        connection.commit()
        return jsonify(success=True, message="Request cancelled. The full amount is back in your room wallet.")

    @app.post("/api/wallet/topup")
    @auth("student")
    def topup():
        amount = integer(payload().get("amount"))
        if amount not in (100, 250, 500):
            return fail("Choose a demo credit amount: ₹100, ₹250, or ₹500.")
        connection = db()
        connection.execute("BEGIN IMMEDIATE")
        room = student_room()
        if room["room_balance"] + amount > 10000:
            return fail("The local demo wallet is limited to ₹10,000.")
        connection.execute("UPDATE room SET room_balance=room_balance+? WHERE room_id=?", (amount, room["room_id"]))
        connection.execute("INSERT INTO wallet_transaction(room_id,reg_no,amount,description,created_at) VALUES(?,?,?,?,?)", (room["room_id"], session["identity"], amount, "Demo credits added · no payment", stamp()))
        connection.commit()
        return jsonify(success=True, message=f"₹{amount} demo credits added to your shared wallet. No payment was taken.")

    @app.post("/api/bookings/<int:booking_id>/feedback")
    @auth("student")
    def feedback(booking_id):
        rating = integer(payload().get("rating"))
        if rating not in range(1, 6):
            return fail("Choose a rating from 1 to 5 stars.")
        connection = db()
        connection.execute("BEGIN IMMEDIATE")
        booking = connection.execute("SELECT * FROM booking WHERE booking_id=? AND room_id=?", (booking_id, student_room()["room_id"])).fetchone()
        if not booking:
            return fail("That request could not be found in your room.", 404)
        if booking["status"] != "Completed" or booking["rating"]:
            return fail("Feedback can be left once per completed request.", 409)
        connection.execute("UPDATE booking SET rating=?,feedback=? WHERE booking_id=?", (rating, text(payload(), "feedback", 500), booking_id))
        event(booking_id, "Feedback", f"Room rated this cleaning {rating}/5")
        connection.commit()
        return jsonify(success=True, message="Thanks for helping us make room care better.")

    @app.get("/api/staff/dashboard")
    @auth("staff")
    def staff_dashboard():
        return jsonify(user=user_info(), bookings=get_bookings(), services=service_list(), server_time=stamp(), demo_mode=app.config["DEMO_MODE"],
                       cleaners=[dict(c) for c in db().execute("SELECT c.cleaner_id,c.name,c.status,b.block_name FROM cleaner c JOIN block b ON b.block_id=c.block_id")])

    # Fixed read-only queries, so the presentation view cannot execute arbitrary SQL.
    database_tables = {
        "student": ("Students", "student", "student", "reg_no,name,email,room_id", "reg_no"),
        "room": ("Rooms", "room", "room", "room_id,block_id,room_number,floor,beds,room_balance", "room_id DESC"),
        "booking": ("Cleaning requests", "booking", "booking", "booking_id,reg_no,room_id,type_id,cleaner_id,scheduled_start_time,amount_charged,status,rating", "booking_id DESC"),
        "billing": ("Room billing", "v_room_billing", "booking", "booking_id,reg_no,block_name,room_number,service,charged,refunded,net_charge,billing_status", "booking_id DESC"),
        "wallet": ("Wallet ledger", "v_room_statement", "wallet_transaction", "transaction_id,room_id,reg_no,booking_id,amount,balance_after,description,created_at", "transaction_id DESC"),
        "events": ("Status history", "booking_event", "booking_event", "event_id,booking_id,status,note,created_at", "event_id DESC"),
        "cleaner": ("Cleaners", "cleaner", "cleaner", "cleaner_id,name,block_id,status", "cleaner_id"),
        "services": ("Cleaning services", "cleaning_type", "cleaning_type", "type_id,type_name,description,duration,price", "type_id"),
        "block": ("Hostel blocks", "block", "block", "block_id,block_name", "block_id"),
    }

    @app.get("/api/staff/database")
    @auth("staff")
    def database_view():
        selected = request.args.get("table", "student")
        if selected not in database_tables:
            return fail("Choose one of the available database tables.")
        page = integer(request.args.get("page", "1"))
        if not page or page < 1:
            return fail("Choose a valid page number.")
        connection = db()
        # One read transaction gives rows, counts and balance checks a consistent snapshot.
        connection.execute("BEGIN")
        tables = []
        for key, (label, source, relation, columns, order) in database_tables.items():
            total = connection.execute(f"SELECT count(*) FROM {source}").fetchone()[0]
            tables.append({"key": key, "label": label, "source": source, "count": total})
        label, source, relation, column_string, order = database_tables[selected]
        total = next(table["count"] for table in tables if table["key"] == selected)
        page_size = 25
        page = min(page, max(1, (total + page_size - 1) // page_size))
        query = f"SELECT {column_string} FROM {source} ORDER BY {order} LIMIT ? OFFSET ?"
        parameters = (page_size, (page - 1) * page_size)
        rows = [dict(row) for row in connection.execute(query, parameters)]
        schema = [dict(row) for row in connection.execute(f"PRAGMA table_info({relation})") if row["name"] in column_string.split(",")]
        foreign_keys = [dict(row) for row in connection.execute(f"PRAGMA foreign_key_list({relation})") if row["from"] in column_string.split(",")]
        mismatches = connection.execute(
            "SELECT r.room_id FROM room r LEFT JOIN wallet_transaction t ON t.room_id=r.room_id "
            "GROUP BY r.room_id HAVING abs(r.room_balance-coalesce(sum(t.amount),0))>0.001").fetchall()
        checks = {"integrity": connection.execute("PRAGMA quick_check").fetchone()[0],
                  "foreign_key_violations": len(connection.execute("PRAGMA foreign_key_check").fetchall()),
                  "wallet_mismatches": len(mismatches)}
        definition = connection.execute("SELECT sql FROM sqlite_master WHERE name=? AND type IN ('table','view')", (source,)).fetchone()
        return jsonify(selected=selected, label=label, source=source, relation=relation,
                       tables=tables, rows=rows, columns=column_string.split(","), schema=schema,
                       foreign_keys=foreign_keys, total=total, page=page, page_size=page_size,
                       sql=query, parameters=parameters, definition=definition[0] if definition else None,
                       checks=checks, database_file=Path(app.config["DATABASE"]).name)

    @app.post("/api/staff/bookings/<int:booking_id>/status")
    @auth("staff")
    def staff_status(booking_id):
        target = text(payload(), "status", 30)
        connection = db()
        connection.execute("BEGIN IMMEDIATE")
        booking = connection.execute("SELECT * FROM booking WHERE booking_id=?", (booking_id,)).fetchone()
        if not booking:
            return fail("That request could not be found.", 404)
        allowed = {"Assigned": ("In Progress", "Cancelled"), "In Progress": ("Completed",)}
        if target not in allowed.get(booking["status"], ()):
            return fail("This request has changed. Refresh and choose the next available action.", 409)
        if target == "In Progress":
            start = datetime.fromisoformat(booking["scheduled_start_time"])
            demo_start = app.config["DEMO_MODE"] and payload().get("demo_override") is True
            if (start.date() != now().date() or start > now() + timedelta(minutes=15)) and not demo_start:
                return fail("Cleaning can start on the scheduled day, up to 15 minutes before the slot.", 409)
            if connection.execute("SELECT 1 FROM booking WHERE booking_id!=? AND status='In Progress' AND (cleaner_id=? OR room_id=?)", (booking_id, booking["cleaner_id"], booking["room_id"])).fetchone():
                return fail("This cleaner or room already has a cleaning in progress.", 409)
        if target == "Cancelled":
            refund(booking, "Cancelled by the hostel desk. Full refund issued.")
        else:
            connection.execute("UPDATE booking SET status=?,completed_at=? WHERE booking_id=?", (target, stamp() if target == "Completed" else None, booking_id))
            note = "Cleaning completed. Your room is ready." if target == "Completed" else (
                "Started by staff using the local presentation demo action." if demo_start else "Your cleaner has started room care.")
            event(booking_id, target, note)
        connection.commit()
        return jsonify(success=True, message=f"Request marked {target.lower()}.")

    def init_db():
        connection = db()
        connection.execute("PRAGMA journal_mode=WAL")
        connection.executescript("""
            CREATE TABLE IF NOT EXISTS block(block_id INTEGER PRIMARY KEY,block_name TEXT NOT NULL UNIQUE);
            CREATE TABLE IF NOT EXISTS room(room_id INTEGER PRIMARY KEY,block_id INTEGER NOT NULL REFERENCES block(block_id),
                room_number INTEGER NOT NULL,floor INTEGER,beds INTEGER DEFAULT 4,room_status TEXT DEFAULT 'Available',
                room_balance REAL NOT NULL DEFAULT 0 CHECK(room_balance>=0),join_code TEXT,UNIQUE(block_id,room_number));
            CREATE TABLE IF NOT EXISTS student(reg_no TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,phone TEXT,room_id INTEGER REFERENCES room(room_id));
            CREATE TABLE IF NOT EXISTS cleaner(cleaner_id INTEGER PRIMARY KEY,name TEXT NOT NULL,phone TEXT,status TEXT DEFAULT 'Available',block_id INTEGER NOT NULL REFERENCES block(block_id));
            CREATE TABLE IF NOT EXISTS cleaning_type(type_id INTEGER PRIMARY KEY,type_name TEXT NOT NULL UNIQUE,description TEXT,duration INTEGER NOT NULL,price REAL NOT NULL CHECK(price>=0));
            CREATE TABLE IF NOT EXISTS booking(booking_id INTEGER PRIMARY KEY,reg_no TEXT NOT NULL REFERENCES student(reg_no),
                type_id INTEGER NOT NULL REFERENCES cleaning_type(type_id),cleaner_id INTEGER REFERENCES cleaner(cleaner_id),
                request_date TEXT,priority TEXT DEFAULT 'Normal',scheduled_start_time TEXT NOT NULL,amount_charged REAL NOT NULL CHECK(amount_charged>=0),
                status TEXT DEFAULT 'Assigned',room_id INTEGER REFERENCES room(room_id),notes TEXT DEFAULT '',rating INTEGER,feedback TEXT,completed_at TEXT,cancelled_at TEXT);
            CREATE TABLE IF NOT EXISTS staff(staff_id INTEGER PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS wallet_transaction(transaction_id INTEGER PRIMARY KEY,room_id INTEGER NOT NULL REFERENCES room(room_id),
                reg_no TEXT REFERENCES student(reg_no),booking_id INTEGER REFERENCES booking(booking_id),amount REAL NOT NULL,description TEXT NOT NULL,created_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS booking_event(event_id INTEGER PRIMARY KEY,booking_id INTEGER NOT NULL REFERENCES booking(booking_id),status TEXT NOT NULL,note TEXT,created_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS schema_version(version INTEGER PRIMARY KEY);
        """)
        # Preserve and migrate the original classroom schema.
        for table, columns in {"room": {"join_code": "TEXT"}, "booking": {
            "room_id": "INTEGER REFERENCES room(room_id)", "notes": "TEXT DEFAULT ''", "rating": "INTEGER",
            "feedback": "TEXT", "completed_at": "TEXT", "cancelled_at": "TEXT"}}.items():
            existing = {r["name"] for r in connection.execute(f"PRAGMA table_info({table})")}
            for name, declaration in columns.items():
                if name not in existing:
                    connection.execute(f"ALTER TABLE {table} ADD COLUMN {name} {declaration}")
        fresh = not connection.execute("SELECT 1 FROM student LIMIT 1").fetchone()
        if not connection.execute("SELECT 1 FROM block LIMIT 1").fetchone():
            connection.executemany("INSERT INTO block(block_name) VALUES(?)", [("T-Block",), ("S-Block",), ("A-Block",), ("B-Block",), ("C-Block",)])
        if fresh:
            block_id = connection.execute("SELECT block_id FROM block ORDER BY block_id LIMIT 1").fetchone()[0]
            connection.execute("INSERT OR IGNORE INTO room(block_id,room_number,floor,beds,room_balance,join_code) VALUES(?,204,2,4,500,'TIDY204')", (block_id,))
            room_id = connection.execute("SELECT room_id FROM room WHERE block_id=? AND room_number=204", (block_id,)).fetchone()[0]
            demo_password = generate_password_hash("pass123")
            connection.executemany("INSERT INTO student(reg_no,name,email,password_hash,room_id) VALUES(?,?,?,?,?)", [
                ("24BDS0052", "Pradyun Shashi", "pradyun@vit.ac.in", demo_password, room_id),
                ("24BCE2124", "Narayana Bhuvan", "bhuvan@vit.ac.in", demo_password, room_id),
                ("24BCI0213", "Shaurya Shah", "shaurya@vit.ac.in", demo_password, room_id)])
        for block in connection.execute("SELECT * FROM block").fetchall():
            if not connection.execute("SELECT 1 FROM cleaner WHERE block_id=?", (block["block_id"],)).fetchone():
                names = ("Ramesh Kumar", "Suresh Reddy") if block["block_name"] == "T-Block" else (f"{block['block_name']} care team 1", f"{block['block_name']} care team 2")
                connection.executemany("INSERT INTO cleaner(name,block_id) VALUES(?,?)", [(n, block["block_id"]) for n in names])
        if not connection.execute("SELECT 1 FROM cleaning_type LIMIT 1").fetchone():
            connection.executemany("INSERT INTO cleaning_type(type_name,description,duration,price) VALUES(?,?,?,?)", [
                ("Everyday clean", "A fresh floor and a lighter space. Sweeping, mopping and bin emptying.", 30, 50),
                ("Deep clean", "A proper reset. Floors, reachable surfaces, corners and sanitisation.", 60, 150),
                ("Room refresh", "A little extra care. Everyday cleaning plus desk and surface dusting.", 45, 90)])
        if not connection.execute("SELECT 1 FROM staff LIMIT 1").fetchone():
            connection.execute("INSERT INTO staff(name,email,password_hash) VALUES(?,?,?)", ("Hostel care team", "staff@vit.ac.in", generate_password_hash("pass123")))
        for room in connection.execute("SELECT room_id FROM room WHERE join_code IS NULL OR join_code=''").fetchall():
            connection.execute("UPDATE room SET join_code=? WHERE room_id=?", (secrets.token_hex(3).upper(), room["room_id"]))
        for student in connection.execute("SELECT reg_no,password_hash FROM student").fetchall():
            if not student["password_hash"].startswith(("scrypt:", "pbkdf2:")):
                connection.execute("UPDATE student SET password_hash=? WHERE reg_no=?", (generate_password_hash(student["password_hash"]), student["reg_no"]))
        connection.execute("UPDATE booking SET room_id=(SELECT room_id FROM student s WHERE s.reg_no=booking.reg_no) WHERE room_id IS NULL")
        connection.execute("CREATE INDEX IF NOT EXISTS booking_room_status ON booking(room_id,status)")
        connection.execute("CREATE INDEX IF NOT EXISTS booking_cleaner_time ON booking(cleaner_id,scheduled_start_time)")
        connection.executescript("""
            CREATE VIEW IF NOT EXISTS v_room_billing AS
            SELECT bk.booking_id,bk.reg_no,bk.room_id,bl.block_name,r.room_number,
                   ct.type_name AS service,bk.amount_charged AS charged,
                   coalesce((SELECT sum(t.amount) FROM wallet_transaction t
                       WHERE t.booking_id=bk.booking_id AND t.description='Cancellation refund'),0) AS refunded,
                   bk.amount_charged-coalesce((SELECT sum(t.amount) FROM wallet_transaction t
                       WHERE t.booking_id=bk.booking_id AND t.description='Cancellation refund'),0) AS net_charge,
                   CASE WHEN bk.status='Cancelled' THEN 'Refunded' ELSE 'Paid from room wallet' END AS billing_status
            FROM booking bk JOIN room r ON r.room_id=bk.room_id
            JOIN block bl ON bl.block_id=r.block_id JOIN cleaning_type ct ON ct.type_id=bk.type_id;
            CREATE VIEW IF NOT EXISTS v_room_statement AS
            SELECT transaction_id,room_id,reg_no,booking_id,amount,description,created_at,
                   sum(amount) OVER (PARTITION BY room_id ORDER BY transaction_id
                       ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS balance_after
            FROM wallet_transaction;
        """)
        if not connection.execute("SELECT 1 FROM schema_version WHERE version=1").fetchone():
            for room in connection.execute("SELECT * FROM room").fetchall():
                connection.execute("INSERT INTO wallet_transaction(room_id,amount,description,created_at) VALUES(?,?,?,?)", (room["room_id"], room["room_balance"], "Opening room balance", stamp()))
            for booking in connection.execute("SELECT * FROM booking").fetchall():
                event(booking["booking_id"], booking["status"], "Imported from your existing room requests.")
            connection.execute("INSERT INTO schema_version VALUES(1)")
        connection.commit()

    with app.app_context():
        init_db()
    return app


if __name__ == "__main__":
    application = create_app()
    print("Tidy is ready at http://127.0.0.1:5000", flush=True)
    application.run(host="127.0.0.1", port=int(os.environ.get("PORT", "5000")), debug=False)
