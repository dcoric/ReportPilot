CREATE TABLE IF NOT EXISTS export_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES query_sessions(id),
  delivery_mode TEXT NOT NULL CHECK (delivery_mode IN ('download', 'email')),
  format TEXT NOT NULL CHECK (format IN ('json', 'csv', 'xlsx')),
  recipients TEXT[],
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  file_name TEXT,
  file_size_bytes BIGINT,
  requested_by TEXT NOT NULL DEFAULT 'anonymous',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_export_deliveries_session_id ON export_deliveries(session_id);
CREATE INDEX IF NOT EXISTS idx_export_deliveries_status ON export_deliveries(status);
