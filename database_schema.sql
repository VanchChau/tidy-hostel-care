-- Structure only: no account data, password hashes or wallet records.
PRAGMA foreign_keys = ON;

CREATE TABLE block(block_id INTEGER PRIMARY KEY,block_name TEXT NOT NULL UNIQUE);

CREATE TABLE booking(booking_id INTEGER PRIMARY KEY,reg_no TEXT NOT NULL REFERENCES student(reg_no),
                type_id INTEGER NOT NULL REFERENCES cleaning_type(type_id),cleaner_id INTEGER REFERENCES cleaner(cleaner_id),
                request_date TEXT,priority TEXT DEFAULT 'Normal',scheduled_start_time TEXT NOT NULL,amount_charged REAL NOT NULL CHECK(amount_charged>=0),
                status TEXT DEFAULT 'Assigned',room_id INTEGER REFERENCES room(room_id),notes TEXT DEFAULT '',rating INTEGER,feedback TEXT,completed_at TEXT,cancelled_at TEXT);

CREATE TABLE booking_event(event_id INTEGER PRIMARY KEY,booking_id INTEGER NOT NULL REFERENCES booking(booking_id),status TEXT NOT NULL,note TEXT,created_at TEXT NOT NULL);

CREATE TABLE cleaner(cleaner_id INTEGER PRIMARY KEY,name TEXT NOT NULL,phone TEXT,status TEXT DEFAULT 'Available',block_id INTEGER NOT NULL REFERENCES block(block_id));

CREATE TABLE cleaning_type(type_id INTEGER PRIMARY KEY,type_name TEXT NOT NULL UNIQUE,description TEXT,duration INTEGER NOT NULL,price REAL NOT NULL CHECK(price>=0));

CREATE TABLE room(room_id INTEGER PRIMARY KEY,block_id INTEGER NOT NULL REFERENCES block(block_id),
                room_number INTEGER NOT NULL,floor INTEGER,beds INTEGER DEFAULT 4,room_status TEXT DEFAULT 'Available',
                room_balance REAL NOT NULL DEFAULT 0 CHECK(room_balance>=0),join_code TEXT,UNIQUE(block_id,room_number));

CREATE TABLE schema_version(version INTEGER PRIMARY KEY);

CREATE TABLE staff(staff_id INTEGER PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL);

CREATE TABLE student(reg_no TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,phone TEXT,room_id INTEGER REFERENCES room(room_id));

CREATE TABLE wallet_transaction(transaction_id INTEGER PRIMARY KEY,room_id INTEGER NOT NULL REFERENCES room(room_id),
                reg_no TEXT REFERENCES student(reg_no),booking_id INTEGER REFERENCES booking(booking_id),amount REAL NOT NULL,description TEXT NOT NULL,created_at TEXT NOT NULL);

CREATE INDEX booking_cleaner_time ON booking(cleaner_id,scheduled_start_time);

CREATE INDEX booking_room_status ON booking(room_id,status);

CREATE VIEW v_room_billing AS
            SELECT bk.booking_id,bk.reg_no,bk.room_id,bl.block_name,r.room_number,
                   ct.type_name AS service,bk.amount_charged AS charged,
                   coalesce((SELECT sum(t.amount) FROM wallet_transaction t
                       WHERE t.booking_id=bk.booking_id AND t.description='Cancellation refund'),0) AS refunded,
                   bk.amount_charged-coalesce((SELECT sum(t.amount) FROM wallet_transaction t
                       WHERE t.booking_id=bk.booking_id AND t.description='Cancellation refund'),0) AS net_charge,
                   CASE WHEN bk.status='Cancelled' THEN 'Refunded' ELSE 'Paid from room wallet' END AS billing_status
            FROM booking bk JOIN room r ON r.room_id=bk.room_id
            JOIN block bl ON bl.block_id=r.block_id JOIN cleaning_type ct ON ct.type_id=bk.type_id;

CREATE VIEW v_room_statement AS
            SELECT transaction_id,room_id,reg_no,booking_id,amount,description,created_at,
                   sum(amount) OVER (PARTITION BY room_id ORDER BY transaction_id
                       ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS balance_after
            FROM wallet_transaction;
