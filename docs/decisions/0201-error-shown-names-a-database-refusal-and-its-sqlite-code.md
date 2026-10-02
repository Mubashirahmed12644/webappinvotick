# 0201 — `error_shown` names a database refusal as local and carries SQLite's primary code
- **Date:** 2026-10-03
- **Status:** decided (app branch `merge/151d-room-284`, commit `7f60f8452` on `release/1.5.1`; not yet in a released build)
- **Decision:** `ErrorShown.kindOf` treats `SQLException` — the name of `androidx.sqlite.SQLException` (Room's bundled
  driver) and `android.database.SQLException` — like the `SQLite…` family: `kind=local`. `error_shown` gains one
  parameter, **`sqlite_code`** (number): SQLite's primary result code, only when a database exception in the cause
  chain stated one. No new event, no message text.
- **Why:** production, 1.5.0: 7 `error_shown` rows ("Couldn't save…") read `kind=unknown` with
  `exception_class=SQLException`. The class is a local database failure, but the test only knew the `SQLite` prefix,
  so the Health Centre's local/unknown split under-counted local failures. The class alone also cannot tell a busy
  database (5, which Room 2.8.4 now waits out, see the connection fix on `fix/150-sqlexception-and-anr`) from a
  constraint (19), a full disk (13) or a corrupt file (11); those need different answers.
- **How the code is read:** the digits of the driver's own sentence (`Error code: 5, …` from the bundled driver,
  `… (code 1299 SQLITE_CONSTRAINT_NOTNULL)` from the framework), reduced by `and 0xFF` so an extended code and its
  primary are one number. The exception has no code property in common code, so the sentence is the only source; only
  the number leaves the phone.
- **Rejected:** copying the message into the event (§1.22, and it can carry data); a second event such as
  `database_error` (one press, one thing, one event, §1.1); sending the extended code (one refusal would split over
  many values); guessing a code when the sentence had none (absent means unknown, §1.7); matching by fully qualified
  class name (not available on every target, and R8 keeps simple names for Throwables).
- **Consequences:** old rows keep `kind=unknown` for `SQLException`; read them by `exception_class`. AGENTS-EVENTS §1.24.
