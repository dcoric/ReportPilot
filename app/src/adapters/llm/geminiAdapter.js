const { postJson, extractJsonObject } = require("./httpClient");

class GeminiAdapter {
  constructor(opts = {}) {
    this.provider = "gemini";
    this.apiKey = opts.apiKey || "";
    this.defaultModel = opts.defaultModel || "gemini-2.0-flash";
    this.timeoutMs = Number(opts.timeoutMs || 15000);
  }

  async healthCheck() {
    if (!this.apiKey) {
      throw new Error("Gemini API key is not configured");
    }
  }

  async generate(input) {
    await this.healthCheck();

    const model = input.model || this.defaultModel;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: input.prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: input.temperature ?? 0,
        maxOutputTokens: input.maxTokens ?? 800
      }
    };

    if (input.systemPrompt) {
      payload.systemInstruction = {
        role: "system",
        parts: [
          {
            text: input.systemPrompt
          }
        ]
      };
    }

    const response = await postJson(endpoint, payload, { timeoutMs: this.timeoutMs });
    const parts = response?.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p.text || "").join("\n").trim();

    if (!text) {
      throw new Error("Gemini returned an empty completion");
    }

    return {
      text,
      model
    };
  }

  async generateStructured(input) {
    const output = await this.generate(input);
    return extractJsonObject(output.text);
  }

  async embed() {
    throw new Error("embed() is not implemented yet for Gemini adapter");
  }
}

module.exports = {
  GeminiAdapter
};
