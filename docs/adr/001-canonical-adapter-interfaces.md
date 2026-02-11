# ADR 001: Canonical Adapter Interfaces for DB and LLM Providers

## Status

Accepted

## Date

2026-02-11

## Context

The product must support:

- Multiple databases (MVP starts with PostgreSQL).
- Multiple LLM providers (MVP starts with OpenAI, Gemini, DeepSeek).

Without stable interfaces, provider-specific logic leaks into orchestration code and slows future expansion.

## Decision

Define strict adapter contracts:

- `DatabaseAdapter`: introspection, validation, explain, execution, dialect helpers.
- `LlmAdapter`: text generation, structured generation, embeddings, health checks.

All runtime business logic (RAG, planning, SQL generation workflow, guardrails) depends only on these interfaces.

## Interface Contracts

```ts
export interface DatabaseAdapter {
  type: string;
  dialect(): SqlDialect;
  testConnection(): Promise<void>;
  introspectSchema(opts?: IntrospectionOptions): Promise<CanonicalSchemaSnapshot>;
  validateSql(sql: string): Promise<ValidationResult>;
  explain(sql: string): Promise<ExplainPlan>;
  executeReadOnly(sql: string, opts: ExecutionOptions): Promise<QueryResult>;
  quoteIdentifier(identifier: string): string;
}

export interface LlmAdapter {
  provider: string;
  healthCheck(): Promise<void>;
  generate(input: LlmGenerateInput): Promise<LlmGenerateOutput>;
  generateStructured<T>(input: LlmStructuredInput<T>): Promise<T>;
  embed(input: EmbedInput): Promise<EmbedOutput>;
}
```

## Provider Registration

- Adapters are discovered through a provider registry.
- Routing rules select primary/fallback adapters by workspace and data source.
- Runtime behavior supports retries only for transient errors.

## Consequences

Positive:

- Easy onboarding of new DB engines and LLM providers.
- Cleaner testability using adapter mocks.
- Reduced blast radius for provider SDK/API changes.

Tradeoffs:

- Initial overhead to maintain canonical data contracts.
- Need compatibility tests per adapter implementation.

## Implementation Notes

- MVP DB adapter: `PostgresAdapter`.
- MVP LLM adapters: `OpenAiAdapter`, `GeminiAdapter`, `DeepSeekAdapter`.
- Enforce contract conformance with shared adapter test suites.
