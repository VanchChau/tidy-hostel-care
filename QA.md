# Validation record

## Database systems presentation update

The suite now has **26 passing integration tests**. A complete registration → new room → ₹250 credit → ₹150 booking → charge/billing view → cancellation/refund → app restart scenario reads each result using a fresh SQLite connection. Staff-only table browsing, table allowlists, pagination, credential exclusion, explicit audited presentation starts and disabling the override are also tested.

The current live database was backed up through SQLite's backup API before adding two read-only SQL views. No student/request data was reset. At verification there were 4 students, 2 rooms, 2 requests and 5 wallet entries, including the account created through the site. SQLite integrity, foreign-key checks and wallet reconciliation all pass. The exported schema was executed in an empty in-memory database successfully, and every read-only example in `database_queries.sql` was executed against the real database without errors.

Browser QA verified the staff Database demo page, saved student rows, PK/FK labels and the dynamically calculated billing records. A disposable fixture also verified **Start now · demo → Mark complete**, then showed the audit rows and explicit presentation note in Status history. No browser console errors were found. The fixture was stopped; the main localhost app remains running. See `DATABASE_DEMO.md` for the professor walkthrough and `preview/database-demo.png` for the console preview.

## Blue-water visual update

Rechecked after the Wi-Fi interruption: localhost returned HTTP 200; all source changes, three demo residents and both saved requests remained present; SQLite integrity passed. Re-ran all 21 integration tests successfully. Shifted the full interface to ocean blues, icy glass surfaces and soft animated ripple details, including login, booking dialogs, room/wallet views and the app icon. Desktop and narrow-screen previews were inspected with no browser console errors. The updated screenshot is `preview/overview-blue.png`. All assets remain local and require no Wi-Fi connection.

Validated locally on 28 October 2026 (IST).

## Automated checks

- `python -m unittest discover -s tests -v`: **21 tests passed**.
- `node --check static/app.js`: passed.
- SQLite `PRAGMA integrity_check`: `ok`.
- SQLite `PRAGMA foreign_key_check`: no violations.
- Shared wallet totals reconcile with the transaction ledger: no mismatches.

The tests cover login/logout, CSRF, role boundaries, student data privacy, account creation and private room joining, invalid inputs, cleaning hours and duration limits, room/cleaner conflicts, cross-block cleaner rejection, concurrent room bookings, concurrent refunds, cancellation cutoffs, staff transitions, ratings, persistence, legacy schema/password migration, and missing legacy room records.

## Browser checks

Checked the actual UI in the in-app browser and desktop Microsoft Edge, including a narrow 319px viewport and a 1280×720 desktop view. The native Edge desktop was also inspected at full screen. No page-width overflow was found in the narrow preview; tables scroll inside their containers. The compact-height sidebar fits without internal overflow at 1280×720.

Verified:

- Student and staff demo sign-in; sign-out and switching account types.
- Service selection → available date/time → notes → review → booking receipt.
- Charge reflected in the wallet, room overview, request details and activity history.
- Cancellation confirmation → full refund → updated balance and timeline.
- Demo top-up selection → updated shared balance and wallet entry.
- Mobile navigation, room information, resident list and room invite code.
- Staff request list, filters, search, empty search results and request details.
- A separate disposable morning fixture exercised staff **Start cleaning → Mark complete**, followed by student **5-star feedback**, without changing the main runtime database.
- Account creation in that disposable fixture, including a new room and zero-balance wallet.
- No browser console errors or warnings in the exercised application flows.
- Live staff updates were verified while a student search field was active: the draft and focused field stayed intact, and the new status appeared on the next background refresh after editing stopped, with the search retained.

An Antigravity IDE read-only review was used as an additional check. Relevant findings were addressed: orphaned legacy room handling, null invite-code handling, background redraws caused by timestamps, and reliance on client clocks for staff readiness. Transaction validation already rolls back when request-scoped SQLite connections close; concurrent booking/refund tests verify the intended atomic behaviour.

## Handoff state

The main demo database contains the original three demo residents in T-Block 204, a cancelled/refunded test booking, a ₹100 demo top-up, and one sample **Room refresh** booking for **29 October 2026 at 11:30 am IST**. Its note explicitly identifies it as a local demo. The final shared balance is **₹510**. No real cleaner is contacted and no money is moved.

The disposable fixture server on port 5001 was stopped after testing. The primary app serves only on **127.0.0.1:5000**. Original source backups are retained in `backups/`. A dashboard screenshot is saved at `preview/overview.png`.

## Scope limits

This verifies a localhost prototype. Real VIT account verification, payment providers, outbound notifications, production deployment and 3D model integration remain outside this build. Browser QA was performed with tools against the live UI; it is not a checked-in automated browser regression suite. The reusable fixture is `python tests/serve_browser_fixture.py`.
