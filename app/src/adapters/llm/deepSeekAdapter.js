const { postJson, extractJsonObject } = require("./httpClient");

class DeepSeekAdapter {
  constructor(opts = {}) {
    this.provider = "deepseek";
    this.apiKey = opts.apiKey || "";
    this.defaultModel = opts.defaultModel || "deepseek-chat";
    this.timeoutMs = Number(opts.timeoutMs || 15000);
    this.baseUrl = opts.baseUrl || "https://api.deepseek.com";
  }

  async healthCheck() {
    if (!this.apiKey) {
      throw new Error("DeepSeek API key is not configured");
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
      throw new Error("DeepSeek returned an empty completion");
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
    throw new Error("embed() is not implemented yet for DeepSeek adapter");
  }
}

module.exports = {
  DeepSeekAdapter
};
