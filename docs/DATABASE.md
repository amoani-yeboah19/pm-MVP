# Database

## Location

The SQLite file lives at the path in the `DB_PATH` environment variable.

| Context | Default |
|---------|---------|
| Docker  | `/app/data/kanban.db` (set via `docker-compose.yml`) |
| Local dev / tests | `kanban.db` in the working directory |

In Docker the `/app/data/` directory is a named volume so the database survives container restarts and rebuilds.

## Initialization

`database.init_db()` is called once on application startup (via FastAPI `lifespan`). It runs `CREATE TABLE IF NOT EXISTS` for every table, so it is safe to call repeatedly and requires no separate migration step for this MVP.

## Seeding

The first time a user logs in, `_seed_user()` in `main.py`:
1. Inserts the username into `users` (idempotent via `INSERT OR IGNORE`).
2. Checks whether a board already exists for that user.
3. If not, creates one board and inserts the five default columns (`Backlog`, `Discovery`, `In Progress`, `Review`, `Done`) at positions 0–4.

No default cards are created — the board starts empty.

## Connections

Each request opens a fresh `sqlite3` connection via the `get_db()` context manager in `database.py`. The connection is committed on success and rolled back on any exception, then closed.

## Future migrations

This project has no migration framework. When the schema needs to change:
1. Add the new `ALTER TABLE` or `CREATE TABLE` statement to `init_db()` guarded by an `IF NOT EXISTS` / `IF NOT EXISTS column` check, or
2. Delete the DB file and let `init_db()` recreate it (acceptable while the schema is still evolving).
