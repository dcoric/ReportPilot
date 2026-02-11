const { validateAstReadOnly } = require("./sqlAstValidator");

function sanitizeGeneratedSql(raw) {
  let text = String(raw || "").trim();
  if (!text) {
    return "";
  }

  const fencedMatch = text.match(/```(?:sql)?\s*([\s\S]*?)```/i);
  if (fencedMatch && fencedMatch[1]) {
    text = fencedMatch[1].trim();
  }

  // If model returns explanation + SQL, keep from first SELECT/WITH onward.
  const startMatch = text.match(/\b(select|with)\b/i);
  if (startMatch && startMatch.index > 0) {
    text = text.slice(startMatch.index).trim();
  }

  return text;
}

function stripTrailingSemicolon(sql) {
  return sql.replace(/;\s*$/, "").trim();
}

function hasMultipleStatements(sql) {
  const trimmed = sql.trim();
  const withoutTrailing = trimmed.replace(/;\s*$/, "");
  return withoutTrailing.includes(";");
}

function hasLimitClause(sql) {
  return /\blimit\s+\d+\b/i.test(sql);
}

function ensureLimit(sql, maxRows) {
  if (hasLimitClause(sql)) {
    return sql;
  }
  return `${stripTrailingSemicolon(sql)} LIMIT ${Number(maxRows)};`;
}

function validateAndNormalizeSql(rawSql, opts = {}) {
  const maxRows = Number(opts.maxRows || 1000);
  const schemaObjects = Array.isArray(opts.schemaObjects) ? opts.schemaObjects : [];

  let sql = sanitizeGeneratedSql(rawSql);
  if (!sql) {
    return { ok: false, sql: "", errors: ["Generated SQL is empty"], refs: [] };
  }

  if (hasMultipleStatements(sql)) {
    return {
      ok: false,
      sql,
      errors: ["Multiple SQL statements are not allowed"],
      refs: []
    };
  }

  sql = ensureLimit(sql, maxRows);

  const refsCheck = validateAstReadOnly(sql, schemaObjects);
  if (!refsCheck.ok) {
    return { ok: false, sql, errors: refsCheck.errors, refs: refsCheck.refs };
  }

  return { ok: true, sql, errors: [], refs: refsCheck.refs };
}

module.exports = {
  validateAndNormalizeSql,
  sanitizeGeneratedSql
};
