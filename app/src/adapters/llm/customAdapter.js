const { postJson, extractJsonObject } = require("./httpClient");

class CustomAdapter {
  constructor(opts = {}) {
    this.provider = opts.provider || "custom";
    this.apiKey = opts.apiKey || "";
    this.defaultModel = opts.defaultModel || "";
    this.timeoutMs = Number(opts.timeoutMs || 15000);
    this.baseUrl = String(opts.baseUrl || "").replace(/\/+$/, "");
  }

  async healthCheck() {
    if (!this.baseUrl) {
      throw new Error("Custom provider base_url is not configured");
    }
    if (!this.apiKey) {
      throw new Error("Custom provider API key is not configured");
    }
  }

  async generate(input) {
    await this.healthCheck();

    const model = input.model || this.defaultModel;
    const payload = {
      model,
      temperature: input.temperature ?? 0,
      max_tokens: input.maxTokens ?? 800,
      messages: [
        {
          role: "system",
          content: input.systemPrompt || "You are a SQL generation assistant."
        },
        {
          role: "user",
          content: input.prompt
        }
      ]
    };

    const response = await postJson(`${this.baseUrl}/chat/completions`, payload, {
      timeoutMs: this.timeoutMs,
      headers: {
        Authorization: `Bearer ${this.apiKey}`
      }
    });

    const text = response?.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error("Custom provider returned an empty completion");
    }

    return {
      text,
      model: response?.model || model,
      usage: response?.usage || null
    };
  }

  async generateStructured(input) {
    const output = await this.generate(input);
    return extractJsonObject(output.text);
  }

  async embed() {
    throw new Error("embed() is not supported for the custom adapter");
  }
}

module.exports = {
  CustomAdapter
};
