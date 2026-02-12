CREATE TABLE IF NOT EXISTS benchmark_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_date TIMESTAMPTZ NOT NULL,
  dataset_file TEXT NOT NULL,
  data_source_id UUID REFERENCES data_sources(id) ON DELETE SET NULL,
  provider TEXT,
  model TEXT,
  summary_json JSONB NOT NULL,
  report_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_benchmark_reports_created_at ON benchmark_reports(created_at DESC);
