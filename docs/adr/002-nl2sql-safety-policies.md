# ADR 002: NL2SQL Safety and Execution Guardrails

## Status

Accepted

## Date

2026-02-11

## Context

NL2SQL systems can produce unsafe or expensive SQL. Reporting use cases require consistent safety controls:

- No data mutation.
- Predictable query cost and latency.
- Tenant and sensitive-data isolation.
- Auditability of generated SQL and results.

## Decision

Adopt a layered safety model:

1. Prompt-level constraints.
2. SQL static validation (AST/policy checks).
3. Optional `EXPLAIN` budget checks.
4. Runtime execution controls.
5. Post-execution auditing and feedback loop.

## Policy Rules

Read-only policy:

- Block statements containing `INSERT`, `UPDATE`, `DELETE`, `MERGE`, `ALTER`, `DROP`, `TRUNCATE`, `CREATE`, `GRANT`, `REVOKE`.
- Allow only `SELECT` (including CTEs that resolve to read-only operations).

Object access policy:

- Permit only allowlisted schemas and objects from the selected data source.
- Reject unresolved or hallucinated identifiers.

Result/cost controls:

- Require `LIMIT` unless explicit aggregate-only query returning one row.
- Default `max_rows`: 1000.
- Default statement timeout: 20s.
- Optional reject based on `EXPLAIN` thresholds (rows/cost).

Sensitive data policy:

- Columns tagged as sensitive must be masked or denied based on role.
- Policy applied before execution.

## Validation Flow

1. Parse SQL into AST.
2. Evaluate statement class (must be read-only).
3. Validate identifiers against canonical schema map.
4. Evaluate denylist/allowlist rules.
5. Apply/verify row limits.
6. Run optional `EXPLAIN` and enforce budget.
7. Execute using read-only DB role.

## Consequences

Positive:

- Significant reduction in destructive or runaway queries.
- Repeatable safety behavior independent of model provider.
- Easier compliance and incident analysis.

Tradeoffs:

- Some valid complex analytical queries may be rejected initially.
- Requires dialect-aware AST tooling and maintenance.

## Metrics

- Safety violation rate (target: 0 critical violations in benchmark and staging).
- Query rejection reason distribution.
- P95 execution latency and timeout rate.
