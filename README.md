# Report Pilot Local Runtime

This repository now includes a local Docker setup with:

- `app`: minimal Report Pilot service runtime (Node.js), auto-runs SQL migrations on startup.
- `db`: dedicated PostgreSQL instance for app metadata and app data.

## Prerequisites

- Docker
- Docker Compose (v2)

## Run

```bash
cd /Users/dcoric/Projects/report-pilot
cp .env.example .env
docker compose up --build
```

Default ports:

- App: `http://localhost:8080`
- Postgres: `localhost:5433` (container internal port is still `5432`)

## Health Endpoints

- `GET /health`
- `GET /ready`

## API Docs

- Swagger UI: `http://localhost:8080/docs`
- OpenAPI spec: `http://localhost:8080/openapi.yaml`

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
- LLM provider keys can be supplied via `.env` (`OPENAI_API_KEY`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`).
- `ALLOW_RULE_BASED_FALLBACK=true` keeps `/run` functional even when no provider key is configured.
- Pre-execution plan budget checks are enabled by default:
  - `EXPLAIN_BUDGET_ENABLED=true`
  - `EXPLAIN_MAX_TOTAL_COST=500000`
  - `EXPLAIN_MAX_PLAN_ROWS=1000000`

## SQL Server (Windows + WSL + AdventureWorks2022)

Quick setup for connecting this app (running in WSL) to SQL Server Express on Windows.

1. Configure SQL Server Express on Windows:
   - Enable `TCP/IP` for `SQLEXPRESS` in SQL Server Configuration Manager.
   - Set a fixed TCP port (for example `1433`) and restart `SQL Server (SQLEXPRESS)`.
   - Enable Mixed Mode authentication (`SQL Server and Windows Authentication mode`).
   - Open Windows Firewall inbound TCP rule for the SQL Server port.

2. Create SQL login and grant read metadata/data access:

```sql
USE master;
CREATE LOGIN report_pilot WITH PASSWORD = 'UseAStrongPasswordHere!';

USE AdventureWorks2022;
CREATE USER report_pilot FOR LOGIN report_pilot;
ALTER ROLE db_datareader ADD MEMBER report_pilot;
GRANT VIEW DEFINITION TO report_pilot;
```

3. In WSL, install `sqlcmd` (Ubuntu 24.04 helper script):

```bash
./install-mssql-tools.sh
```

4. Validate connectivity from WSL:

```bash
WIN_IP=$(ip route | awk '/default/ {print $3}')
sqlcmd -S "$WIN_IP,1433" -U report_pilot -P 'UseAStrongPasswordHere!' -d AdventureWorks2022 -C -Q "SELECT TOP 1 name FROM sys.tables"
```

5. Register MSSQL data source in the app using SQL auth (not trusted connection):

```text
Server=<WIN_IP>,1433;Database=AdventureWorks2022;User Id=report_pilot;Password=UseAStrongPasswordHere!;Encrypt=True;TrustServerCertificate=True;
```

Note: `Trusted_Connection=True` is not supported in this Linux runtime flow.

## Current API (Implemented)

Health:

- `GET /health`
- `GET /ready`

Data sources and schema:

- `GET /v1/data-sources`
- `POST /v1/data-sources`
- `POST /v1/data-sources/{id}/introspect`
- `GET /v1/schema-objects?data_source_id=...`

Semantic/admin:

- `POST /v1/semantic-entities`
- `POST /v1/metric-definitions`
- `POST /v1/join-policies`

Query sessions:

- `POST /v1/query/sessions`
- `POST /v1/query/sessions/{id}/run`
- `POST /v1/query/sessions/{id}/feedback`

`/v1/query/sessions/{id}/run` now returns:

- `provider` (selected provider + model)
- `confidence` (heuristic score)
- `citations` (schema/semantic/metric/join context references)

`/v1/query/sessions/{id}/feedback` now stores validated `corrected_sql` examples into `nl_sql_examples` (source=`feedback`) when valid.

LLM provider config:

- `POST /v1/llm/providers`
- `POST /v1/llm/routing-rules`
- `GET /v1/health/providers`

Observability:

- `GET /v1/observability/metrics?window_hours=24`
- `GET /v1/observability/release-gates`
- `GET /v1/observability/benchmark-command`
- `POST /v1/observability/release-gates/report`

RAG:

- `POST /v1/rag/reindex?data_source_id=...`
- RAG reindex also runs automatically after introspection, semantic changes, and saved feedback examples.
- `/v1/query/sessions/{id}/run` uses retrieved RAG chunks in prompt context and returns `citations.rag_documents`.
- Retrieval is hybrid: lexical token matching + embeddings + reranking.
- Embeddings:
  - `RAG_EMBED_PROVIDER=auto|openai|gemini|local`
  - `RAG_EMBED_MODEL_OPENAI=text-embedding-3-small`
  - `RAG_EMBED_MODEL_GEMINI=text-embedding-004`
  - falls back to local hash embeddings when provider embeddings are unavailable.

Quick provider setup example:

```bash
curl -X POST http://localhost:8080/v1/llm/providers \
  -H 'Content-Type: application/json' \
  -d '{"provider":"openai","api_key_ref":"env:OPENAI_API_KEY","default_model":"gpt-4.1-mini","enabled":true}'
```

## MVP Benchmark (Phase 5)

Benchmark assets:

- Dataset: `/Users/dcoric/Projects/report-pilot/docs/evals/dvdrental-mvp-benchmark.json` (60 reporting prompts)
- Runner: `/Users/dcoric/Projects/report-pilot/app/src/benchmark/runMvpBenchmark.js`

Recommended flow with the dvdrental fixture:

```bash
# 1) Start dvdrental test DB
docker compose -f test-data/docker-compose.yml up -d

# 2) Start app stack (metadata DB + API)
docker compose up --build -d

# 3) Run benchmark
BENCHMARK_DATA_SOURCE_NAME=dvdrental \
BENCHMARK_CONNECTION_REF=postgresql://postgres:postgres@host.docker.internal:5440/dvdrental \
BENCHMARK_ORACLE_CONN=postgresql://postgres:postgres@localhost:5440/dvdrental \
npm run benchmark:mvp
```

Note: on first initialization of `test-data`, the restore script shifts all `date`/`timestamp` fields by dynamic offsets so the latest rental and latest payment land around yesterday (relative to system time), then caps shifted values at current system date/time to avoid future-dated rows.

Report outputs:

- JSON and Markdown reports in `/Users/dcoric/Projects/report-pilot/docs/evals/reports`
- Benchmark summary is also persisted to the app DB via `POST /v1/observability/release-gates/report`
- Runner exits with code `2` when one or more MVP release gates fail.

Progress tracker:

- `/Users/dcoric/Projects/report-pilot/IMPLEMENTATION_PLAN.md`
