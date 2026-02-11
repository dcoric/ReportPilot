# AI-DB Local Runtime

This repository now includes a local Docker setup with:

- `app`: minimal AI-DB service runtime (Node.js), auto-runs SQL migrations on startup.
- `db`: dedicated PostgreSQL instance for app metadata and app data.

## Prerequisites

- Docker
- Docker Compose (v2)

## Run

```bash
cd /Users/dcoric/Projects/ai-db
cp .env.example .env
docker compose up --build
```

Default ports:

- App: `http://localhost:8080`
- Postgres: `localhost:5433` (container internal port is still `5432`)

## Health Endpoints

- `GET /health`
- `GET /ready`

Examples:

```bash
curl http://localhost:8080/health
curl http://localhost:8080/ready
```

## Stop

```bash
docker compose down
```

To also remove the DB volume:

```bash
docker compose down -v
```

## Notes

- On startup, the app applies SQL files from `db/migrations` to the local Postgres container.
- Migration state is tracked in the `schema_migrations` table.
