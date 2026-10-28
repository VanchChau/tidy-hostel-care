-- Read-only examples for the database systems demonstration.
-- Run against hostel_cleaning.db in a SQLite client, not an empty database.
PRAGMA foreign_keys = ON;

-- 1. Students with their room and block (joins across three stored tables).
SELECT s.reg_no, s.name, s.email, b.block_name, r.room_number, r.room_balance
FROM student s
JOIN room r ON r.room_id = s.room_id
JOIN block b ON b.block_id = r.block_id
ORDER BY s.reg_no;

-- 2. Requests with the resident, service and assigned cleaner.
SELECT bk.booking_id, s.name AS booked_by, r.room_number, ct.type_name,
       c.name AS cleaner_name, bk.scheduled_start_time,
       bk.amount_charged, bk.status
FROM booking bk
JOIN student s ON s.reg_no = bk.reg_no
JOIN room r ON r.room_id = bk.room_id
JOIN cleaning_type ct ON ct.type_id = bk.type_id
LEFT JOIN cleaner c ON c.cleaner_id = bk.cleaner_id
ORDER BY bk.booking_id DESC;

-- 3. Billing is calculated dynamically from booking charges and refund entries.
SELECT booking_id, block_name, room_number, service,
       charged, refunded, net_charge, billing_status
FROM v_room_billing
ORDER BY booking_id DESC;

-- 4. Every wallet entry, with a per-room running balance (a window function).
SELECT transaction_id, room_id, booking_id, amount, balance_after,
       description, created_at
FROM v_room_statement
ORDER BY room_id, transaction_id;

-- 5. Room-level cleaning totals (aggregation / GROUP BY).
SELECT block_name, room_number, count(*) AS requests,
       sum(charged) AS total_charges, sum(refunded) AS total_refunds,
       sum(net_charge) AS net_cleaning_spend
FROM v_room_billing
GROUP BY room_id, block_name, room_number;

-- 6. Audit trail: each saved status transition has its own row.
SELECT event_id, booking_id, status, note, created_at
FROM booking_event
ORDER BY event_id DESC;

-- 7. Reconciliation: this query should return ZERO rows.
SELECT r.room_id, r.room_balance AS saved_balance,
       coalesce(sum(t.amount), 0) AS ledger_balance
FROM room r
LEFT JOIN wallet_transaction t ON t.room_id = r.room_id
GROUP BY r.room_id
HAVING abs(r.room_balance - coalesce(sum(t.amount), 0)) > 0.001;

-- 8. Schema and integrity checks.
PRAGMA table_info(student);
PRAGMA foreign_key_list(booking);
PRAGMA integrity_check;
PRAGMA foreign_key_check;

-- 9. The actual definitions of the two SQL views.
SELECT name, sql FROM sqlite_master WHERE type = 'view' ORDER BY name;
