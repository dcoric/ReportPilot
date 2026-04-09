function createBadRequestError(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

function normalizeProviderUpsertInput(body, existingProvider, knownProviders) {
  const requestBody = body && typeof body === "object" ? body : {};
  const provider = typeof requestBody.provider === "string" ? requestBody.provider.trim() : "";
  const defaultModel = typeof requestBody.default_model === "string" ? requestBody.default_model.trim() : "";
  const requestedBaseUrl =
    typeof requestBody.base_url === "string" && requestBody.base_url.trim() ? requestBody.base_url.trim() : null;
  const requestedDisplayName =
    typeof requestBody.display_name === "string" && requestBody.display_name.trim()
      ? requestBody.display_name.trim()
      : null;
  const { enabled } = requestBody;
  const apiKeyRefProvided = Object.prototype.hasOwnProperty.call(requestBody, "api_key_ref");
  const requestedApiKeyRef = typeof requestBody.api_key_ref === "string" ? requestBody.api_key_ref.trim() : "";

  if (!provider || !defaultModel || typeof enabled !== "boolean") {
    throw createBadRequestError("provider, default_model, enabled are required");
  }

  if (apiKeyRefProvided && !requestedApiKeyRef) {
    throw createBadRequestError("api_key_ref must be a non-empty string");
  }

  const apiKeyRef = apiKeyRefProvided ? requestedApiKeyRef : existingProvider?.api_key_ref || "";
  if (!apiKeyRef) {
    throw createBadRequestError("api_key_ref is required");
  }

  const isKnown = knownProviders.has(provider);
  const baseUrl = isKnown ? null : requestedBaseUrl || existingProvider?.base_url || null;
  const displayName = isKnown ? null : requestedDisplayName || existingProvider?.display_name || null;
  const isCustom = !isKnown && Boolean(baseUrl);

  if (!isKnown && !isCustom) {
    throw createBadRequestError("Invalid provider");
  }
  if (requestedBaseUrl && isKnown) {
    throw createBadRequestError("base_url is only allowed for custom providers");
  }
  if (isCustom && !/^https?:\/\/.+/.test(baseUrl)) {
    throw createBadRequestError("Invalid base_url");
  }

  return {
    provider,
    apiKeyRef,
    defaultModel,
    baseUrl,
    displayName,
    enabled
  };
}

module.exports = {
  normalizeProviderUpsertInput
};
