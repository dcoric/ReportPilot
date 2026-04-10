const appDb = require("../lib/appDb");
const { json, badRequest, readJsonBody } = require("../lib/http");
const { LLM_PROVIDERS, ROUTING_STRATEGIES } = require("../lib/constants");
const { normalizeProviderUpsertInput } = require("../services/providerConfigService");
const { OpenAiAdapter } = require("../adapters/llm/openAiAdapter");
const { GeminiAdapter } = require("../adapters/llm/geminiAdapter");
const { DeepSeekAdapter } = require("../adapters/llm/deepSeekAdapter");
const { OpenRouterAdapter } = require("../adapters/llm/openRouterAdapter");
const { CustomAdapter } = require("../adapters/llm/customAdapter");
const { resolveApiKey } = require("../adapters/llm/httpClient");

function buildHealthAdapter(provider, apiKeyRef, defaultModel, baseUrl) {
  if (provider === "openai") {
    return new OpenAiAdapter({
      apiKey: resolveApiKey(apiKeyRef, "OPENAI_API_KEY"),
      defaultModel
    });
  }
  if (provider === "gemini") {
    return new GeminiAdapter({
      apiKey: resolveApiKey(apiKeyRef, "GEMINI_API_KEY"),
      defaultModel
    });
  }
  if (provider === "deepseek") {
    return new DeepSeekAdapter({
      apiKey: resolveApiKey(apiKeyRef, "DEEPSEEK_API_KEY"),
      defaultModel
    });
  }
  if (provider === "openrouter") {
    return new OpenRouterAdapter({
      apiKey: resolveApiKey(apiKeyRef, "OPENROUTER_API_KEY"),
      defaultModel
    });
  }
  if (baseUrl) {
    return new CustomAdapter({
      provider,
      apiKey: resolveApiKey(apiKeyRef, null),
      defaultModel,
      baseUrl
    });
  }
  throw new Error(`Unsupported provider: ${provider}`);
}

async function loadSupportedProviderSet() {
  const result = await appDb.query("SELECT provider FROM llm_providers");
  const providers = new Set(LLM_PROVIDERS);
  for (const row of result.rows) {
    if (row.provider) {
      providers.add(row.provider);
    }
  }
  return providers;
}

async function handleProviderList(_req, res) {
  const result = await appDb.query(
    `SELECT id, provider, default_model, base_url, display_name, enabled, created_at, updated_at
     FROM llm_providers
     ORDER BY provider`
  );
  return json(res, 200, { items: result.rows });
}

async function handleProviderUpsert(req, res) {
  const body = await readJsonBody(req);
  const provider = typeof body.provider === "string" ? body.provider.trim() : "";

  const existingResult = await appDb.query(
    `
      SELECT api_key_ref, base_url, display_name
      FROM llm_providers
      WHERE provider = $1
    `,
    [provider]
  );
  const existingProvider = existingResult.rows[0] || null;
  const normalized = normalizeProviderUpsertInput(body, existingProvider, LLM_PROVIDERS);

  const result = await appDb.query(
    `
      INSERT INTO llm_providers (provider, api_key_ref, default_model, base_url, display_name, enabled, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (provider)
      DO UPDATE SET
        api_key_ref = EXCLUDED.api_key_ref,
        default_model = EXCLUDED.default_model,
        base_url = EXCLUDED.base_url,
        display_name = EXCLUDED.display_name,
        enabled = EXCLUDED.enabled,
        updated_at = NOW()
      RETURNING provider, base_url, display_name, enabled
    `,
    [
      normalized.provider,
      normalized.apiKeyRef,
      normalized.defaultModel,
      normalized.baseUrl,
      normalized.displayName,
      normalized.enabled
    ]
  );

  return json(res, 200, result.rows[0]);
}

async function handleRoutingRuleUpsert(req, res) {
  const body = await readJsonBody(req);
  const {
    data_source_id: dataSourceId,
    primary_provider: primaryProvider,
    fallback_providers: fallbackProviders,
    strategy
  } = body;

  if (!dataSourceId || !primaryProvider || !Array.isArray(fallbackProviders) || !strategy) {
    return badRequest(res, "data_source_id, primary_provider, fallback_providers, strategy are required");
  }

  const supportedProviders = await loadSupportedProviderSet();

  if (!supportedProviders.has(primaryProvider)) {
    return badRequest(res, "Invalid primary_provider");
  }

  if (!ROUTING_STRATEGIES.has(strategy)) {
    return badRequest(res, "Invalid strategy");
  }

  const invalidFallback = fallbackProviders.find((provider) => !supportedProviders.has(provider));
  if (invalidFallback) {
    return badRequest(res, `Invalid fallback provider: ${invalidFallback}`);
  }

  const dataSourceResult = await appDb.query("SELECT id FROM data_sources WHERE id = $1", [dataSourceId]);
  if (dataSourceResult.rowCount === 0) {
    return json(res, 404, { error: "not_found", message: "Data source not found" });
  }

  const result = await appDb.query(
    `
      INSERT INTO llm_routing_rules (
        data_source_id,
        primary_provider,
        fallback_providers,
        strategy,
        updated_at
      ) VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (data_source_id)
      DO UPDATE SET
        primary_provider = EXCLUDED.primary_provider,
        fallback_providers = EXCLUDED.fallback_providers,
        strategy = EXCLUDED.strategy,
        updated_at = NOW()
      RETURNING id
    `,
    [dataSourceId, primaryProvider, fallbackProviders, strategy]
  );

  return json(res, 200, result.rows[0]);
}

async function handleProviderHealth(_req, res) {
  const result = await appDb.query(
    `
      SELECT provider, api_key_ref, default_model, base_url, enabled
      FROM llm_providers
      ORDER BY provider
    `
  );

  const checkedAt = new Date().toISOString();
  const items = [];

  for (const row of result.rows) {
    if (!row.enabled) {
      items.push({
        provider: row.provider,
        status: "down",
        checked_at: checkedAt
      });
      continue;
    }

    try {
      const adapter = buildHealthAdapter(row.provider, row.api_key_ref, row.default_model, row.base_url);
      await adapter.healthCheck();
      items.push({
        provider: row.provider,
        status: "healthy",
        checked_at: checkedAt
      });
    } catch (err) {
      items.push({
        provider: row.provider,
        status: "degraded",
        checked_at: checkedAt,
        reason: err.message
      });
    }
  }

  return json(res, 200, { items });
}

module.exports = {
  handleProviderList,
  handleProviderUpsert,
  handleRoutingRuleUpsert,
  handleProviderHealth
};
