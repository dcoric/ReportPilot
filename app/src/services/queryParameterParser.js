const PLACEHOLDER_REGEX = /(?<!:):([a-z][a-z0-9_]*)\b/gi;

function createDefaultParameterSchemaEntry(name) {
  return {
    name,
    type: "text",
    required: true,
    default: null,
    allowed_values: null
  };
}

function stripSingleQuotedLiterals(sql) {
  const text = String(sql || "");
  let output = "";
  let index = 0;

  while (index < text.length) {
    if (text[index] !== "'") {
      output += text[index];
      index += 1;
      continue;
    }

    output += " ";
    index += 1;

    while (index < text.length) {
      output += " ";

      if (text[index] === "'" && text[index + 1] === "'") {
        output += " ";
        index += 2;
        continue;
      }

      if (text[index] === "'") {
        index += 1;
        break;
      }

      index += 1;
    }
  }

  return output;
}

function extractPlaceholders(sql) {
  const stripped = stripSingleQuotedLiterals(sql);
  const seen = new Set();
  const placeholders = [];

  for (const match of stripped.matchAll(PLACEHOLDER_REGEX)) {
    const name = String(match[1] || "").toLowerCase();
    if (seen.has(name)) {
      continue;
    }
    seen.add(name);
    placeholders.push(name);
  }

  return placeholders;
}

function buildParameterSchemaFromPlaceholders(placeholders, existingSchema = []) {
  const existingMap = new Map();
  for (const entry of Array.isArray(existingSchema) ? existingSchema : []) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry) || typeof entry.name !== "string") {
      continue;
    }
    existingMap.set(entry.name, {
      name: entry.name,
      type: typeof entry.type === "string" ? entry.type : "text",
      required: entry.required !== false,
      default: Object.prototype.hasOwnProperty.call(entry, "default") ? entry.default : null,
      allowed_values: Object.prototype.hasOwnProperty.call(entry, "allowed_values") ? entry.allowed_values : null
    });
  }

  return (Array.isArray(placeholders) ? placeholders : []).map((name) => existingMap.get(name) || createDefaultParameterSchemaEntry(name));
}

function replaceNamedPlaceholders(sql, replacer) {
  const text = String(sql || "");
  let output = "";
  let index = 0;

  while (index < text.length) {
    if (text[index] === "'") {
      output += "'";
      index += 1;

      while (index < text.length) {
        output += text[index];

        if (text[index] === "'" && text[index + 1] === "'") {
          output += "'";
          index += 2;
          continue;
        }

        if (text[index] === "'") {
          index += 1;
          break;
        }

        index += 1;
      }

      continue;
    }

    const slice = text.slice(index);
    const match = slice.match(/^:([a-z][a-z0-9_]*)\b/i);
    if (match && text[index - 1] !== ":") {
      const placeholderName = String(match[1] || "").toLowerCase();
      output += String(replacer(placeholderName, match[0]));
      index += match[0].length;
      continue;
    }

    output += text[index];
    index += 1;
  }

  return output;
}

module.exports = {
  extractPlaceholders,
  buildParameterSchemaFromPlaceholders,
  replaceNamedPlaceholders,
  stripSingleQuotedLiterals
};
