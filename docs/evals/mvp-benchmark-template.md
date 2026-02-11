# MVP NL2SQL Benchmark Template

## Purpose

Measure correctness, safety, latency, and cost for reporting-focused NL -> SQL behavior.

## Dataset Definition

- Data source: `<data_source_id>`
- SQL dialect: `postgres` (MVP)
- Question set size target: 50 to 100 prompts
- Coverage:
  - Aggregations
  - Trends/time-series
  - Group-by dimensions
  - Filters (date, status, geography, product)
  - Joins across 2 to 4 tables

## Case Template

Use one row per benchmark case.

| id | nl_question | expected_tables | expected_metrics | expected_filters | expected_sql_oracle | result_assertion | risk_level |
|---|---|---|---|---|---|---|---|
| q001 | Monthly net revenue for 2025 by region | sales.orders,sales.order_items | net_revenue | order_date in 2025 | `SELECT ...` | sum values match oracle | medium |

Notes:

- `expected_sql_oracle` can be canonical SQL or a saved query id.
- `result_assertion` should verify result equivalence, not exact SQL string.

## Execution Protocol

1. Freeze semantic catalog and schema snapshot version.
2. Run each case with fixed provider/model and config.
3. Capture generated SQL and execution outputs.
4. Evaluate assertions using oracle checks.
5. Record safety policy outcomes.

## Metrics

Primary:

- Result correctness rate.
- Critical safety violations (must be zero).
- P95 end-to-end latency.

Secondary:

- SQL validity rate.
- First-attempt success rate.
- Average token usage (prompt/completion).
- Estimated cost per query.

## Pass/Fail Gates (MVP)

- Correctness >= 85%.
- Critical safety violations = 0.
- P95 latency <= 8s on staging profile.
- SQL validation pass rate >= 98%.

## Report Template

### Summary

- Run date: `<YYYY-MM-DD>`
- Data source: `<name>`
- Provider/model: `<provider>/<model>`
- Cases executed: `<n>`

### Results

- Correctness: `<x%>`
- Safety violations: `<count>`
- P95 latency: `<ms>`
- Mean cost/query: `<value>`

### Top Failure Modes

1. `<failure mode>`
2. `<failure mode>`
3. `<failure mode>`

### Action Items

1. `<prompt/retrieval change>`
2. `<semantic mapping gap fix>`
3. `<validation rule adjustment>`
