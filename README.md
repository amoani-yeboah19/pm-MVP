# Kanban Studio

An AI-powered project management board. Drag cards, rename columns, and ask an AI assistant to manage your board through natural language — all persisted in a SQLite database and served from a single Docker container.

---

## Features

**Board**
- Five fully customizable columns
- Drag-and-drop cards between columns with instant optimistic updates
- Add cards with title + details, rename columns inline, delete cards
- All state persists across page reloads via the backend

**AI Assistant**
- Natural language board control — no commands to memorise
- Add cards, move cards between columns, rename columns, delete cards — all via chat
- Full conversation history maintained per session
- Structured JSON output (gpt-4o-mini via OpenRouter) parsed into atomic DB mutations
- Board state is always consistent — mutations only apply if the full update succeeds

**Auth**
- HTTP-only signed session cookie (itsdangerous)
- Login gates the entire board; logout clears the session

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| Backend | Python 3.12, FastAPI, SQLite (stdlib), uvicorn |
| AI | OpenRouter API → gpt-4o-mini, openai Python SDK |
| Auth | itsdangerous URLSafeTimedSerializer (signed cookie) |
| Testing | Vitest + Testing Library, pytest + pytest-cov, Playwright |
| Infra | Docker multi-stage build, docker-compose |

---

## Getting Started

### Prerequisites

- Docker + Docker Compose
- An OpenRouter API key — free tier available at [openrouter.ai](https://openrouter.ai)

### Run in 3 steps

```bash
# 1. Clone
git clone https://github.com/amoani-yeboah19/pm-MVP
cd pm-MVP

# 2. Add your key
echo "OPENROUTER_API_KEY=sk-or-..." > .env

# 3. Start
docker compose up --build
```

Open **http://localhost:8000** and sign in with `user` / `password`.

---

## Architecture

```
Browser
  ├── KanbanBoard (drag-drop, CRUD)
  └── AISidebar (chat thread, board updates)
        │
        │  Cookie-authenticated HTTP
        ▼
  FastAPI (Python)
  ├── POST /api/auth/login|logout  ─── signed session cookie
  ├── GET  /api/board              ─── full board state
  ├── PUT  /api/board/columns/:id  ─── rename column
  ├── POST /api/board/cards        ─── create card
  ├── PUT  /api/board/cards/:id/move ─ move card
  ├── DELETE /api/board/cards/:id  ─── delete card
  └── POST /api/ai/chat            ─── AI chat + board mutations
        │
        ├── SQLite  (kanban.db — persisted on Docker volume)
        └── OpenRouter API → gpt-4o-mini
```

### AI flow

```
User message
    │
    ▼
Board state is fetched from DB and embedded in a system prompt
    │
    ▼
gpt-4o-mini responds with structured JSON:
  { "message": "...", "board_update": { add_cards, move_cards, ... } }
    │
    ▼
board_update applied atomically to SQLite
    │
    ▼
Response includes updated board — frontend updates without a reload
```

---

## AI Capabilities

Try asking:

- *"Add a card 'Deploy to staging' to the In Progress column"*
- *"Move 'Fix login bug' to Done"*
- *"What's in my Backlog?"*
- *"Rename 'Review' to 'QA'"*
- *"Delete all cards in Backlog"*

---

## Testing

```bash
# Backend — 27 tests, 91% coverage
cd backend
uv run pytest

# Frontend unit tests — 18 tests, 90% statements
cd frontend
npm run test:unit

# E2E — 12 Playwright tests against the Docker container
cd frontend
BASE_URL=http://localhost:8000 npx playwright test
```

---

## Project Structure

```
├── backend/
│   ├── main.py          # FastAPI app, all routes
│   ├── ai.py            # OpenRouter chat + Pydantic models
│   ├── auth.py          # Session cookie helpers
│   ├── database.py      # SQLite init + connection context manager
│   └── tests/           # pytest suite
├── frontend/
│   ├── src/
│   │   ├── components/  # KanbanBoard, KanbanColumn, KanbanCard, AISidebar, LoginPage
│   │   └── lib/         # api.ts (typed fetch wrapper), kanban.ts (types + DnD logic)
│   └── tests/           # Playwright E2E specs
├── docs/
│   ├── PLAN.md          # 10-part build plan
│   └── SCHEMA.md        # SQLite schema
├── Dockerfile           # Multi-stage: node build → python runtime
└── docker-compose.yml
```

---

## Credentials

Default login: `user` / `password` (hardcoded for the MVP — easy to swap for a real user table).
