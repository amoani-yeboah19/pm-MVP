# Project Plan — Kanban Studio MVP

> Read this document before starting any part. Check off each item as it completes. A part is done only when all its checkboxes are ticked and all its success criteria are met.

---

## Part 1: Plan

- [x] Read all existing frontend code and understand the current state
- [x] Create `frontend/AGENTS.md` documenting the existing frontend code
- [x] Enrich this document with detailed substeps, tests, and success criteria for all parts
- [x] User approval obtained

**Success criteria:** This document is fully detailed and user has approved it before any code is written.

---

## Part 2: Scaffolding

Set up the Docker infrastructure, the FastAPI backend skeleton, and start/stop scripts. Serve example static HTML from FastAPI and verify a health-check API call works end to end.

### Steps

- [x] Create `backend/` directory structure: `main.py`, `pyproject.toml` (uv-managed)
- [x] Implement FastAPI app in `backend/main.py`:
  - `GET /api/health` — returns `{"status": "ok"}`
  - Placeholder static file mount for `/` (serves a minimal HTML page for now)
- [x] Create `Dockerfile` in project root:
  - Use a Python slim base image
  - Install uv and use it to install backend dependencies
  - Copy backend source
  - Expose port 8000; default CMD runs uvicorn
- [x] Create `docker-compose.yml` for local development (mounts `.env`, maps port 8000)
- [x] Write `scripts/start.sh` and `scripts/stop.sh` for Mac/Linux
- [x] Write `scripts/start.bat` and `scripts/stop.bat` for Windows
- [x] Update `backend/AGENTS.md` with backend structure description
- [x] Write backend unit tests (pytest):
  - `GET /api/health` → 200, `{"status": "ok"}` — 2/2 passing, 100% coverage
- [x] Manual Docker verification: `docker compose up --build` → `http://localhost:8000` serves HTML and `/api/health` returns `{"status":"ok"}`

### Tests

- **pytest**: `GET /api/health` returns 200 with body `{"status": "ok"}`
- **Manual**: `docker compose up` → `http://localhost:8000` → HTML page visible
- **Manual**: `GET http://localhost:8000/api/health` → JSON response

### Success Criteria

- Docker image builds and container starts without errors
- `http://localhost:8000` serves HTML
- `http://localhost:8000/api/health` returns `{"status":"ok"}`
- Start and stop scripts run successfully on the host platform
- All pytest tests pass

---

## Part 3: Add in Frontend

Statically build the Next.js frontend, embed it in the Docker image, and serve it from FastAPI at `/`.

### Steps

- [x] Configure Next.js for static export: set `output: 'export'` in `next.config.ts`
- [x] Verify `next build` produces an `out/` directory with no errors
- [x] Update `Dockerfile` to a multi-stage build:
  - **Stage 1 (node)**: install npm deps, run `next build`, output is `out/`
  - **Stage 2 (python)**: copy `out/` from Stage 1, install backend deps via uv
- [x] Configure FastAPI to serve `out/` as static files at `/`
  - All non-API paths should serve `index.html` (SPA fallback)
- [x] Verify Kanban board renders correctly when served from the Docker container
- [x] Set Vitest coverage threshold to ≥80% in `vitest.config.ts`
- [x] Expand frontend unit tests until coverage threshold passes — 82% statements, 80% branches/functions
- [x] Update Playwright config to support `BASE_URL` env var for Docker integration tests
- [x] Confirm all 3 existing Playwright E2E tests pass against the Docker URL — 3/3 passing

### Tests

- **pytest**: `GET /` returns 200 with HTML containing "Kanban Studio"
- **pytest**: Non-API path (e.g. `/some/path`) returns 200 (SPA fallback)
- **Vitest + coverage**: all source files ≥80% line coverage
- **Playwright (Docker)**: page loads, add card, drag card — all 3 pass

### Success Criteria

- `next build` completes without errors and produces static `out/`
- Docker image serves the Kanban board at `http://localhost:8000`
- All Playwright E2E tests pass against `http://localhost:8000`
- `npm run test:unit` passes with coverage ≥80%

---

## Part 4: Fake User Sign-In

Add a login screen gating the Kanban board. Hardcoded credentials: `user` / `password`. Support logout. Session managed via an HTTP-only cookie set by the backend.

### Steps

- [x] Add backend auth endpoints:
  - `POST /api/auth/login` — validate `{username, password}` body; on success set an HTTP-only session cookie and return `{"ok": true}`; on failure return 401
  - `POST /api/auth/logout` — clear the session cookie, return `{"ok": true}`
  - `GET /api/auth/me` — return `{"username": "user"}` if cookie valid, else 401
- [x] Implement session as a signed cookie (`itsdangerous`; secret loaded from env)
- [x] Write backend pytest tests for all 3 auth endpoints — 5 tests, 96% coverage
- [x] Create `src/components/LoginPage.tsx` in the frontend
- [x] Add auth state to the app (`App.tsx`): on mount call `GET /api/auth/me`; show `LoginPage` if 401, else show `KanbanBoard`
- [x] Add logout button to the `KanbanBoard` header
- [x] Write Playwright E2E tests — 4 auth tests + 3 kanban tests, all 7 passing

### Tests

- **pytest (login)**: correct creds → 200 + Set-Cookie header; wrong creds → 401
- **pytest (logout)**: valid session → 200 + cookie cleared
- **pytest (me)**: valid cookie → 200 `{"username":"user"}`; no cookie → 401
- **RTL**: `LoginPage` renders username + password fields; invalid submit shows error; valid submit calls onSuccess
- **Playwright**: `/` with no session shows login form; login with "user"/"password" shows board; logout returns to login

### Success Criteria

- Kanban board is unreachable without a valid session
- Correct credentials grant access; incorrect credentials display an error
- Logout clears session and returns to login page
- All pytest and Playwright tests pass
- Vitest coverage remains ≥80%

---

## Part 5: Database Modeling

Design the SQLite schema, document it, and get user sign-off before writing any migration code.

### Steps

- [x] Design SQLite schema covering:
  - `users (id, username, password_hash)`
  - `boards (id, user_id, name)`
  - `columns (id, board_id, title, position)`
  - `cards (id, column_id, title, details, position)`
- [x] Save schema with full `CREATE TABLE` statements in `docs/SCHEMA.md`
- [x] Document DB file location, auto-creation strategy, and future migration approach in `docs/DATABASE.md`
- [x] Present schema to user and obtain explicit approval before proceeding to Part 6

### Tests

- N/A — documentation step only; code follows in Part 6

### Success Criteria

- `docs/SCHEMA.md` contains complete, runnable `CREATE TABLE` statements
- `docs/DATABASE.md` documents location, creation, and migration strategy
- User has explicitly approved the schema

---

## Part 6: Backend API

Implement all Kanban board CRUD API routes. Auto-create the SQLite DB on startup. Protect all board routes with the session auth from Part 4.

### Steps

- [x] Add DB initialization: on startup, create the SQLite file and run `CREATE TABLE IF NOT EXISTS` for all tables
- [x] Add a SQLite connection helper (use `aiosqlite` for async or `sqlite3` with thread pool)
- [x] On first successful login for a user, seed one board with the five default columns (no cards)
- [x] Implement board endpoints (all require valid session cookie, return 401 otherwise):
  - `GET /api/board` — full board state `{columns, cards}` for the logged-in user
  - `PUT /api/board/columns/{column_id}` — rename a column `{title}`
  - `POST /api/board/cards` — create card `{column_id, title, details}`, appended to column
  - `PUT /api/board/cards/{card_id}` — update card `{title?, details?}`
  - `DELETE /api/board/cards/{card_id}` — delete card
  - `PUT /api/board/cards/{card_id}/move` — move card `{column_id, position}`
- [x] Write pytest unit tests for every endpoint:
  - Unauthenticated → 401
  - Happy path → correct response shape and DB state verified
  - Unknown IDs → 404
- [x] Write pytest integration tests covering multi-step flows
- [x] Enforce ≥80% backend line coverage via `pytest-cov --fail-under=80`

### Tests

- **pytest unit** (per endpoint): unauthed 401; happy path; 404 on bad IDs
- **pytest integration**: create card → rename column → move card → delete card → verify `GET /api/board` reflects all changes
- **pytest-cov**: `--fail-under=80` must pass

### Success Criteria

- All endpoints return correct shapes and HTTP status codes
- DB file is created automatically if it does not exist
- No board endpoint is reachable without a valid session
- Backend test coverage ≥80%
- Integration tests cover the full CRUD lifecycle

---

## Part 7: Frontend + Backend Integration

Replace all in-memory frontend state with live API calls. Board changes must persist across page reloads.

### Steps

- [x] Create `src/lib/api.ts` — typed fetch wrapper for all board and auth endpoints
- [x] In `KanbanBoard`, replace `initialData` with a `useEffect` that calls `GET /api/board` on mount; show a loading indicator while fetching
- [x] Handle 401 from `GET /api/board`: clear auth state and show `LoginPage`
- [x] Wire each handler to its API call; update local state only on success:
  - `handleRenameColumn` → `PUT /api/board/columns/{id}`
  - `handleAddCard` → `POST /api/board/cards`
  - `handleDeleteCard` → `DELETE /api/board/cards/{id}`
  - `handleDragEnd` → `PUT /api/board/cards/{id}/move`
- [x] Add error feedback (inline message or toast) when an API call fails
- [x] Update frontend unit tests: mock `fetch`, assert each handler calls the correct endpoint with the correct payload
- [x] Update Playwright E2E tests: verify persistence (add card → reload → card still present; rename column → reload → name persists; delete card → reload → card gone)

### Tests

- **RTL**: mock `fetch`; assert `GET /api/board` called on mount; assert each mutation handler calls correct endpoint; assert loading state shown; assert error state shown on fetch failure
- **Playwright**: add card + reload (persists); rename column + reload (persists); delete card + reload (gone)
- **Vitest coverage**: remains ≥80%

### Success Criteria

- All board mutations persist across page reloads
- No in-memory-only state changes — every mutation goes through the API
- Loading and error states are visible in the UI
- All tests pass including persistence Playwright tests

---

## Part 8: AI Connectivity

Add an OpenRouter call to the backend. Verify connectivity with a simple arithmetic test prompt.

### Steps

- [x] Load `OPENROUTER_API_KEY` from environment (`python-dotenv` loads `.env` automatically; Docker gets it from `env_file`)
- [x] Create `backend/ai.py` with `ask(prompt: str) -> str` using the `openai` Python SDK pointed at `https://openrouter.ai/api/v1`; model `openai/gpt-oss-120b` hardcoded
- [x] Add `POST /api/ai/ping` endpoint (auth required) — calls `ask("What is 2+2?")` and returns `{"response": "<answer>"}`
- [x] Write pytest tests using **real** OpenRouter API calls (no mocking); requires `OPENROUTER_API_KEY` in `.env`
- [ ] Rebuild Docker and verify `POST /api/ai/ping` returns a valid AI response end-to-end

### Tests

- **pytest (mocked)**: `ask("What is 2+2?")` returns a non-empty string without raising
- **pytest**: `POST /api/ai/ping` (with mocked `ask`) returns 200 with `{"response": <str>}`
- **Manual**: real call to `POST /api/ai/ping` returns something recognizable as "4"

### Success Criteria

- `POST /api/ai/ping` returns a valid AI response
- API key is loaded from the environment — never hardcoded
- All tests pass with mocked responses
- Backend coverage remains ≥80%

---

## Part 9: Structured AI + Board Updates

Extend the AI call so it always receives the full board JSON and conversation history, and responds with structured output that optionally includes board mutations.

### Steps

- [x] Define a Pydantic response model for structured AI output:
  ```
  AIResponse:
    message: str
    board_update: BoardUpdate | None

  BoardUpdate:
    add_cards:      list[{column_id, title, details}]
    move_cards:     list[{card_id, column_id, position}]
    delete_card_ids: list[str]
    rename_columns: list[{column_id, title}]
  ```
- [x] Update `backend/ai.py` to:
  - Accept board state dict + conversation history list
  - Construct a system prompt embedding the board JSON
  - Use OpenRouter JSON mode (or function calling) to enforce the structured schema
  - Parse and validate the response against the Pydantic model
- [x] Add `POST /api/ai/chat` endpoint (requires auth):
  - Body: `{message: str, history: [{role, content}]}`
  - Fetches current board, calls AI with board + history + message
  - If `board_update` is non-null, applies all mutations to the DB atomically
  - Returns `{message: str, board_update: ...|null, board: <full updated board>}`
- [x] Write pytest unit tests:
  - AI response with `board_update` → mutations applied, DB updated
  - AI response with `board_update: null` → DB unchanged
  - Malformed AI response → 500 with a safe error message (board unchanged)
- [x] Write pytest integration test: full `POST /api/ai/chat` with mocked AI → verify DB reflects mutations

### Tests

- **pytest unit**: parse structured response with each mutation type → correct DB state
- **pytest unit**: null `board_update` → board in DB unchanged
- **pytest unit**: invalid AI JSON → graceful error, board unchanged
- **pytest integration**: chat endpoint with mocked AI returning `add_cards` → `GET /api/board` shows new card
- **pytest-cov**: `ai.py` ≥80% coverage

### Success Criteria

- Chat endpoint returns `{message, board_update, board}` on every call
- All board mutations from AI are persisted atomically to the DB
- Malformed or missing structured output is handled gracefully (message returned, board not mutated)
- Backend coverage remains ≥80%

---

## Part 10: AI Sidebar UI

Add a full-featured AI chat sidebar to the Kanban board. When the AI returns board mutations, refresh the board automatically.

### Steps

- [x] Create `src/components/AISidebar.tsx`:
  - Scrollable conversation thread (user messages right-aligned, AI replies left-aligned)
  - Text input + send button; Enter submits, Shift+Enter inserts newline
  - Loading indicator (spinner or pulsing text) while awaiting AI response
  - Disabled input while loading
- [x] Add a toggle button to the `KanbanBoard` header to open/close the sidebar
- [x] When sidebar is open, the board grid narrows to accommodate it (CSS grid or flex layout)
- [x] Wire `AISidebar` to `POST /api/ai/chat`:
  - Maintain `history` state (list of `{role, content}`) in `AISidebar`
  - Append user message to history before sending; append AI `message` to history after receiving
  - If `board_update` is non-null, update `KanbanBoard` state directly from the response board
- [x] Style sidebar using project color tokens (consistent with existing board UI)
- [x] Write RTL unit tests for `AISidebar`:
  - Renders empty state with input and button
  - Typing and submitting adds user message to thread
  - Loading indicator shown during API call; input disabled
  - AI reply rendered after response resolves
- [x] Write Playwright E2E tests:
  - Open sidebar, send a message, receive a reply visible in thread
  - Open/close sidebar toggle works correctly

### Tests

- **RTL**: empty state render; submit adds user message; loading state; AI reply shown; board update triggers re-fetch
- **Playwright**: open sidebar → send message → AI reply visible; AI creates card → card appears on board

### Success Criteria

- Sidebar opens and closes without layout breakage
- Conversation history is maintained for the duration of the session
- Board refreshes automatically when AI returns a `board_update`
- No extra API calls when `board_update` is null
- Vitest coverage remains ≥80%
- All Playwright E2E tests pass against the Docker container

---

## Testing Standards (all parts)

- Write tests that are genuinely valuable — covering real behaviour and edge cases. Do not add tests purely to hit a coverage number.
- **Playwright E2E**: must pass against the running Docker container (not just `next dev`) from Part 3 onward
- A part is not complete until all checkboxes are checked, all tests pass, and all success criteria are met
