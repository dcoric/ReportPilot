const { Parser } = require("node-sql-parser");

const parser = new Parser();

function normalizeIdentifier(identifier) {
  return String(identifier || "")
    .replace(/^"+|"+$/g, "")
    .trim()
    .toLowerCase();
}

function parseAst(sql) {
  try {
    return parser.astify(sql, { database: "Postgresql" });
  } catch (err) {
    return {
      error: `SQL parse error: ${err.message}`
    };
  }
}

function validateSingleSelect(ast) {
  const statements = Array.isArray(ast) ? ast : [ast];
  if (statements.length !== 1) {
    return { ok: false, errors: ["Only one SQL statement is allowed"] };
  }

  const statement = statements[0];
  if (!statement || statement.type !== "select") {
    return { ok: false, errors: ["Only SELECT queries are allowed"] };
  }

  return { ok: true, errors: [] };
}

function extractRefsFromTableList(sql) {
  let rawRefs = [];
  try {
    rawRefs = parser.tableList(sql, { database: "Postgresql" });
  } catch {
    rawRefs = [];
  }

  return rawRefs
    .map((entry) => {
      const parts = String(entry).split("::");
      if (parts.length !== 3) {
        return null;
      }

      const [, schemaPart, objectPart] = parts;
      if (!objectPart) {
        return null;
      }

      const schema = normalizeIdentifier(schemaPart === "null" ? "public" : schemaPart);
      const object = normalizeIdentifier(objectPart);
      return { schema, object, raw: `${schema}.${object}` };
    })
    .filter(Boolean);
}

function validateAllowlistedObjects(sql, schemaObjects) {
  const refs = extractRefsFromTableList(sql);

  if (!Array.isArray(schemaObjects) || schemaObjects.length === 0) {
    return { ok: true, errors: [], refs };
  }

  const allowSet = new Set(
    (schemaObjects || []).map((obj) => `${obj.schema_name.toLowerCase()}.${obj.object_name.toLowerCase()}`)
  );

  const unknown = refs.filter((ref) => !allowSet.has(`${ref.schema}.${ref.object}`));

  if (unknown.length > 0) {
    return {
      ok: false,
      errors: [`Unknown or non-allowlisted objects referenced: ${unknown.map((x) => x.raw).join(", ")}`],
      refs
    };
  }

  return {
    ok: true,
    errors: [],
    refs
  };
}

function validateAstReadOnly(sql, schemaObjects) {
  const parsed = parseAst(sql);
  if (parsed.error) {
    return { ok: false, errors: [parsed.error], refs: [] };
  }

  const statementCheck = validateSingleSelect(parsed);
  if (!statementCheck.ok) {
    return { ok: false, errors: statementCheck.errors, refs: [] };
  }

  return validateAllowlistedObjects(sql, schemaObjects);
}

module.exports = {
  validateAstReadOnly
};
