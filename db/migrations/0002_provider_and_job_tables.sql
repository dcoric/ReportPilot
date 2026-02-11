CREATE TABLE IF NOT EXISTS introspection_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS llm_providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL UNIQUE CHECK (provider IN ('openai', 'gemini', 'deepseek')),
  api_key_ref TEXT NOT NULL,
  default_model TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS llm_routing_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  primary_provider TEXT NOT NULL CHECK (primary_provider IN ('openai', 'gemini', 'deepseek')),
  fallback_providers TEXT[] NOT NULL DEFAULT '{}',
  strategy TEXT NOT NULL CHECK (strategy IN ('ordered_fallback', 'cost_optimized', 'latency_optimized')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (data_source_id)
);

CREATE INDEX IF NOT EXISTS idx_introspection_jobs_data_source ON introspection_jobs(data_source_id);
