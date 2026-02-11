function json(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function notFound(res) {
  return json(res, 404, { error: "not_found" });
}

function badRequest(res, message) {
  return json(res, 400, { error: "bad_request", message });
}

function internalError(res, message = "internal_server_error") {
  return json(res, 500, { error: "internal_error", message });
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("Invalid JSON body");
    error.statusCode = 400;
    throw error;
  }
}

module.exports = {
  json,
  notFound,
  badRequest,
  internalError,
  readJsonBody
};
