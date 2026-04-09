ALTER TABLE llm_providers
  ADD COLUMN IF NOT EXISTS base_url TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT;

ALTER TABLE llm_providers
  DROP CONSTRAINT IF EXISTS llm_providers_provider_check,
  ADD CONSTRAINT llm_providers_provider_check CHECK (
    (provider IN ('openai', 'gemini', 'deepseek', 'openrouter') AND base_url IS NULL)
    OR base_url IS NOT NULL
  );

ALTER TABLE llm_routing_rules
  DROP CONSTRAINT IF EXISTS llm_routing_rules_primary_provider_check,
  ADD CONSTRAINT llm_routing_rules_primary_provider_check CHECK (btrim(primary_provider) <> '');
