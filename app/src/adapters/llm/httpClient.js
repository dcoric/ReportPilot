async function postJson(url, body, opts = {}) {
  const timeoutMs = Number(opts.timeoutMs || 15000);
  const headers = Object.assign(
    {
      "Content-Type": "application/json"
    },
    opts.headers || {}
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const text = await response.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      const error = new Error(
        `HTTP ${response.status} from provider: ${parsed?.error?.message || text || "unknown error"}`
      );
      error.statusCode = response.status;
      throw error;
    }

    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

function extractJsonObject(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    throw new Error("Model response is empty");
  }

  try {
    return JSON.parse(raw);
  } catch {
    const fenced = raw.match(/```json\s*([\s\S]*?)```/i);
    if (fenced && fenced[1]) {
      return JSON.parse(fenced[1].trim());
    }

    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(raw.slice(firstBrace, lastBrace + 1));
    }
    throw new Error("Could not parse JSON from model response");
  }
}

function resolveApiKey(ref, defaultEnvKey) {
  const candidates = [];
  if (ref) {
    candidates.push(ref);
  }
  if (defaultEnvKey) {
    candidates.push(`env:${defaultEnvKey}`);
  }

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    if (candidate.startsWith("env:")) {
      const envName = candidate.slice(4).trim();
      if (envName && process.env[envName]) {
        return process.env[envName];
      }
      continue;
    }
    if (candidate.startsWith("plain:")) {
      return candidate.slice(6);
    }
    if (process.env[candidate]) {
      return process.env[candidate];
    }
    return candidate;
  }

  return "";
}

module.exports = {
  postJson,
  extractJsonObject,
  resolveApiKey
};
