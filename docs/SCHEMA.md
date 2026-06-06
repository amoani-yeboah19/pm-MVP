# Database Schema

SQLite database. All tables use `CREATE TABLE IF NOT EXISTS` so startup is idempotent.

```sql
CREATE TABLE IF NOT EXISTS users (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT    NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS boards (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name    TEXT    NOT NULL DEFAULT 'My Board'
);

CREATE TABLE IF NOT EXISTS columns (
    id       TEXT    PRIMARY KEY,
    board_id INTEGER NOT NULL REFERENCES boards(id),
    title    TEXT    NOT NULL,
    position INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cards (
    id        TEXT    PRIMARY KEY,
    column_id TEXT    NOT NULL REFERENCES columns(id),
    title     TEXT    NOT NULL,
    details   TEXT    NOT NULL DEFAULT '',
    position  INTEGER NOT NULL
);
```

## Notes

- `users.username` is the credential key from the hardcoded auth layer. No password is stored — auth is handled entirely by `auth.py`.
- Column and card `id` values are text slugs (e.g. `col-backlog`, `card-abc123`), not auto-incremented integers.
- `position` is a 0-based integer used to order items within their parent. Reindexed on every move.
- Foreign keys are enforced at the connection level via `PRAGMA foreign_keys = ON`.
