# Stage 1: build the Next.js frontend
FROM node:22-slim AS frontend-builder
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Python backend
FROM python:3.12-slim
WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

# Install Python dependencies (cached separately from source)
COPY backend/pyproject.toml ./pyproject.toml
RUN uv sync --no-dev

# Copy backend source then frontend static output
COPY backend/ .
COPY --from=frontend-builder /frontend/out ./out

# Persistent data directory (mounted as a Docker volume)
RUN mkdir -p /app/data

EXPOSE 8000
CMD ["uv", "run", "--no-sync", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
