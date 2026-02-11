const appDb = require("../lib/appDb");

async function retrieveRagContext(dataSourceId, question, opts = {}) {
  const limit = Number(opts.limit || 12);
  const q = String(question || "").trim();

  if (!q) {
    return [];
  }

  const result = await appDb.query(
    `
      SELECT
        id,
        doc_type,
        ref_id,
        content,
        metadata_json
      FROM rag_documents
      WHERE data_source_id = $1
      ORDER BY created_at DESC
      LIMIT 400
    `,
    [dataSourceId]
  );

  const tokens = tokenize(q);
  const ranked = result.rows
    .map((row) => ({
      ...row,
      score: computeScore(q, tokens, row.content)
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length >= limit) {
    return ranked.slice(0, limit);
  }

  const usedIds = new Set(ranked.map((row) => row.id));
  const fill = result.rows
    .filter((row) => !usedIds.has(row.id))
    .slice(0, Math.max(0, limit - ranked.length))
    .map((row) => ({ ...row, score: 0 }));

  return ranked.concat(fill);
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function computeScore(question, tokens, content) {
  const haystack = String(content || "").toLowerCase();
  if (!haystack) {
    return 0;
  }

  let score = 0;
  const normalizedQuestion = String(question || "").toLowerCase();
  if (normalizedQuestion && haystack.includes(normalizedQuestion)) {
    score += 3;
  }

  const uniqueTokens = new Set(tokens);
  for (const token of uniqueTokens) {
    if (haystack.includes(token)) {
      score += 1;
    }
  }

  return score;
}

module.exports = {
  retrieveRagContext
};
