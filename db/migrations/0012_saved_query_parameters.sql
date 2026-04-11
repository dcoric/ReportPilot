ALTER TABLE saved_queries
  ADD COLUMN IF NOT EXISTS parameter_schema JSONB NOT NULL DEFAULT '[]'::jsonb;
