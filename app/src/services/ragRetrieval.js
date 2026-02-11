const appDb = require("../lib/appDb");
const { EMBEDDING_MODEL, embedText, cosineSimilarity } = require("./localEmbedding");

async function retrieveRagContext(dataSourceId, question, opts = {}) {
  const limit = Number(opts.limit || 12);
  const q = String(question || "").trim();

  if (!q) {
    return [];
  }

  const result = await appDb.query(
    `
      SELECT
        rd.id,
        rd.doc_type,
        rd.ref_id,
        rd.content,
        rd.metadata_json,
        re.vector_json
      FROM rag_documents rd
      LEFT JOIN rag_embeddings re
        ON re.rag_document_id = rd.id
       AND re.embedding_model = $2
      WHERE rd.data_source_id = $1
      ORDER BY rd.created_at DESC
      LIMIT 400
    `,
    [dataSourceId, EMBEDDING_MODEL]
  );

  const tokens = tokenize(q);
  const qVector = embedText(q);
  const ranked = result.rows
    .map((row) => ({
      ...row,
      score: computeHybridScore(q, tokens, qVector, row.content, row.vector_json)
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

function computeHybridScore(question, tokens, qVector, content, vectorJson) {
  const lexical = computeLexicalScore(question, tokens, content);
  const vector = computeVectorScore(qVector, vectorJson);
  return Number((lexical + (vector * 2)).toFixed(4));
}

function computeLexicalScore(question, tokens, content) {
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

function computeVectorScore(queryVector, vectorJson) {
  const docVector = Array.isArray(vectorJson) ? vectorJson : null;
  if (!docVector || docVector.length === 0) {
    return 0;
  }
  const cosine = cosineSimilarity(queryVector, docVector);
  if (!Number.isFinite(cosine) || cosine <= 0) {
    return 0;
  }
  return cosine;
}

module.exports = {
  retrieveRagContext
};
