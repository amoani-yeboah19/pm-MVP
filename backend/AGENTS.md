# Backend — Kanban Studio

## Overview

Python FastAPI backend. Serves the statically built Next.js frontend and exposes all API routes under `/api/`. Runs inside Docker via uvicorn. Uses uv as the package manager.

## Stack

- **Framework**: FastAPI 0.115+
- **Server**: uvicorn (with standard extras)
- **Package manager**: uv
- **Python**: 3.12+
- **Tests**: pytest + pytest-cov + httpx (FastAPI TestClient)

## Directory Layout

```
backend/
  main.py         — FastAPI app, all routes registered here
  pyproject.toml  — project metadata and dependencies (uv-managed)
  uv.lock         — generated lock file (commit to version control)
  tests/
    __init__.py
    test_main.py  — pytest tests for all routes
```

## Running Locally (without Docker)

```bash
cd backend
uv sync          # creates .venv and installs all deps including dev
uv run uvicorn main:app --reload
```

## Running Tests

```bash
cd backend
uv run pytest
```

Coverage report is printed automatically (configured in pyproject.toml).

## API Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Returns `{"status": "ok"}` |
| GET | `/` | Placeholder HTML (replaced by static frontend in Part 3) |

More routes are added in Parts 4, 6, 8, and 9.

## Docker

The `Dockerfile` at the project root builds a single-stage Python image:
1. Copies `backend/pyproject.toml` and runs `uv sync --no-dev`
2. Copies backend source
3. Starts uvicorn on port 8000

See the project root `docker-compose.yml` for local orchestration.
