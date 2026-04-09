# AGENTS.md — Report Pilot

## Project Overview

Report Pilot is a local-first NL-to-SQL runtime for reporting workflows.

It combines:

- A Node.js backend API for schema ingestion, query orchestration, provider routing, and audit storage
- A PostgreSQL metadata database managed by SQL migrations
- A React frontend for data source setup, schema exploration, query authoring, provider management, and observability
- A retrieval + LLM pipeline that turns natural-language reporting questions into validated read-only SQL

The core design principle is a layered architecture:

1. Adapter layer for database and LLM providers
2. Service layer for orchestration and policy enforcement
3. API layer for HTTP endpoints
4. UI layer for admin and analyst workflows

Keep responsibilities in those layers. Avoid scattering SQL safety or provider logic directly into route handlers or frontend components.

## Build And Run

```bash
# Install root and frontend dependencies
npm run setup

# Run backend + frontend locally
npm run dev

# Run backend only
npm run dev:be

# Run frontend only
npm run dev:fe

# Apply DB migrations
npm run migrate

# Run backend tests
npm test

# Build everything
npm run build

# Build frontend only
npm run build:fe

# Run the benchmark suite
npm run benchmark:mvp

# Frontend lint
npm --prefix frontend run lint
```

Docker local stack:

```bash
cp .env.example .env
docker compose up --build
```

Default app port: `8080`

## High-Level Architecture

```text
React UI (/frontend)
  -> HTTP API (/app/src/server.js)
      -> Service layer (/app/src/services)
          -> LLM adapters (/app/src/adapters/llm)
          -> DB adapters (/app/src/adapters)
          -> Metadata DB (/db/migrations, app DB tables)
          -> Target reporting databases (Postgres first, MSSQL supported)
```

### 1. Backend API (`/app/src`)

The backend exposes health, data source, schema, query, provider, RAG, export, and observability endpoints.

Key entry points:

- `app/src/start.js` boots the service
- `app/src/server.js` defines the HTTP API
- `app/src/migrate.js` applies SQL migrations

The backend owns:

- Data source registration and introspection
- Query session lifecycle
- NL-to-SQL generation and retries
- SQL validation and read-only enforcement
- RAG indexing and retrieval
- Provider health and routing
- Observability, exports, and delivery flows

### 2. Database Layer

Application metadata lives in PostgreSQL and is defined by ordered SQL migrations in `/db/migrations`.

Rules:

- Add schema changes as new numbered migration files, never by editing applied migrations
- Keep migration names descriptive
- If a feature needs persisted state, update migrations first and then wire service logic to the new schema

### 3. Database Adapters (`/app/src/adapters`)

Database-specific execution and introspection belongs in adapters.

Current adapters:

- `postgresAdapter.js`
- `mssqlAdapter.js`
- `dbAdapterFactory.js`

Keep dialect-specific quoting, validation, introspection, and execution in adapters rather than service code.

### 4. LLM Provider Adapters (`/app/src/adapters/llm`)

Provider-specific HTTP calls, health checks, and embedding generation belong here.

Current providers:

- OpenAI
- Gemini
- DeepSeek
- OpenRouter
- Custom adapter support

Routing policy belongs in shared services such as `providerConfigService.js`, `llmSqlService.js`, and `embeddingRouter.js`, not inside individual provider adapters.

### 5. Service Layer (`/app/src/services`)

This is the core of the system.

Important modules include:

- `llmSqlService.js` and `sqlGenerator.js` for generation orchestration
- `sqlAstValidator.js`, `sqlSafety.js`, and `queryBudget.js` for guardrails
- `introspectionService.js` and `ddlImportService.js` for schema ingestion
- `ragService.js` and `ragRetrieval.js` for indexing and retrieval
- `providerConfigService.js` for provider config and routing
- `observabilityService.js`, `exportService.js`, and `deliveryService.js` for operational workflows

Prefer putting business rules here rather than in routes or UI code.

### 6. Frontend (`/frontend/src`)

The React frontend is organized by pages plus focused components.

Primary areas:

- `pages/QueryWorkspace.tsx` for the main analyst query flow
- `pages/DataSources.tsx` and related dialogs for source setup and RAG notes
- `pages/SchemaExplorer.tsx` for metadata browsing
- `pages/LLMProviders.tsx` for provider configuration
- `pages/Observability.tsx` and `pages/ReleaseGates.tsx` for operational visibility

API client code lives under `frontend/src/lib/api`.

If backend request or response shapes change, update:

- `docs/api/openapi.yaml`
- `frontend/src/lib/api/types.ts`
- Any affected client calls or UI flows

## Core Product Invariants

These rules matter more than local implementation preference.

### Read-Only SQL Only

This project is for reporting queries. Do not introduce paths that allow writes, DDL, or unsafe escape hatches.

- Preserve AST-based validation
- Preserve read-only execution constraints
- Preserve budget and plan checks unless there is a deliberate, reviewed design change

### Ground SQL In Known Metadata

Generated SQL should be grounded in introspected schema, semantic definitions, RAG notes, and validated examples.

- Do not silently bypass retrieval or validation
- Keep citations and confidence behavior aligned with the actual generation flow
- Reindex RAG when schema or semantic inputs change

### Keep Adapter Boundaries Clean

- DB-specific logic stays in DB adapters
- Provider-specific logic stays in LLM adapters
- Cross-provider routing and policy stays in services

If a change cuts across providers or databases, implement the shared behavior in the service layer and keep adapters thin.

### Preserve Auditability And Operability

When changing query execution, provider routing, exports, or observability:

- Keep structured operational signals intact
- Preserve release-gate and benchmark behavior where applicable
- Avoid hiding failures that should surface in metrics, feedback, or logs

## Change Guidance

### When Changing API Behavior

- Update the route implementation
- Update `docs/api/openapi.yaml`
- Update generated or handwritten frontend API types and affected UI code
- Add or adjust backend tests when behavior changes

### When Changing Query Generation Or Safety

- Review `llmSqlService.js`, `sqlGenerator.js`, `sqlAstValidator.js`, `sqlSafety.js`, and `queryBudget.js` together
- Test both valid reporting queries and rejection paths
- Preserve confidence, citations, and feedback capture unless the change explicitly redesigns them

### When Changing Schema Introspection Or RAG

- Keep schema metadata and indexed documents consistent
- Ensure reindex triggers still happen after introspection, semantic edits, or feedback examples
- Verify provider-embedding fallback behavior remains coherent

### When Changing Frontend UX

- Keep desktop and mobile behavior reasonable
- Preserve existing route structure unless there is a concrete navigation reason to change it
- Prefer focused component updates over page-level sprawl

## Testing Expectations

At minimum, run the narrowest commands that exercise the changed surface.

Common choices:

- `npm test`
- `npm run build`
- `npm --prefix frontend run build`
- `npm --prefix frontend run lint`

For benchmark or release-gate work, also run the relevant benchmark flow.

## Practical Notes

- Environment variables live in `.env`; keep `.env.example` in sync when adding required config
- Local test database fixtures and connection setup live under `/test-data`
- Benchmark assets live under `/docs/evals`
- Repo-local agent skills live under `.agents/skills/`
- Planning docs in `/PLAN` and `IMPLEMENTATION_PLAN.md` describe feature intent, but the source of truth for runtime behavior is the code plus migrations
