const BLOCKED_SQL_KEYWORDS = [
  "insert",
  "update",
  "delete",
  "merge",
  "alter",
  "drop",
  "truncate",
  "create",
  "grant",
  "revoke"
];

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

function normalizeIdentifier(identifier) {
  return String(identifier || "")
    .replace(/^"+|"+$/g, "")
    .trim()
    .toLowerCase();
}

function extractReferencedObjects(sql) {
  const refs = [];
  const regex = /\b(from|join)\s+((?:"[^"]+"|\w+)(?:\.(?:"[^"]+"|\w+))?)/gi;
  let match;
  while ((match = regex.exec(sql)) !== null) {
    const rawRef = match[2];
    const parts = rawRef.split(".");
    if (parts.length === 1) {
      refs.push({
        schema: "public",
        object: normalizeIdentifier(parts[0]),
        raw: rawRef
      });
    } else {
      refs.push({
        schema: normalizeIdentifier(parts[0]),
        object: normalizeIdentifier(parts[1]),
        raw: rawRef
      });
    }
  }
  return refs;
}

function validateReferencedObjects(sql, schemaObjects) {
  const allowed = new Set(
    (schemaObjects || []).map((obj) => `${obj.schema_name.toLowerCase()}.${obj.object_name.toLowerCase()}`)
  );

  const refs = extractReferencedObjects(sql);
  const unknown = refs.filter((ref) => !allowed.has(`${ref.schema}.${ref.object}`));
  if (unknown.length === 0) {
    return { ok: true, errors: [], refs };
  }

  return {
    ok: false,
    errors: [`Unknown or non-allowlisted objects referenced: ${unknown.map((u) => u.raw).join(", ")}`],
    refs
  };
}

function validateReadOnly(sql) {
  const normalized = String(sql || "").trim().toLowerCase();
  if (!normalized) {
    return { ok: false, errors: ["SQL is empty"] };
  }

  if (!(normalized.startsWith("select") || normalized.startsWith("with"))) {
    return { ok: false, errors: ["Only SELECT queries are allowed"] };
  }

  const blocked = BLOCKED_SQL_KEYWORDS.find((keyword) =>
    new RegExp(`\\b${keyword}\\b`, "i").test(normalized)
  );
  if (blocked) {
    return { ok: false, errors: [`Blocked SQL keyword detected: ${blocked}`] };
  }

  return { ok: true, errors: [] };
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

  const readOnly = validateReadOnly(sql);
  if (!readOnly.ok) {
    return { ok: false, sql, errors: readOnly.errors, refs: [] };
  }

  const refsCheck = validateReferencedObjects(sql, schemaObjects);
  if (!refsCheck.ok) {
    return { ok: false, sql, errors: refsCheck.errors, refs: refsCheck.refs };
  }

  return { ok: true, sql, errors: [], refs: refsCheck.refs };
}

module.exports = {
  validateAndNormalizeSql,
  sanitizeGeneratedSql
};
