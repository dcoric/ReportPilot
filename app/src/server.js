const http = require("http");
const { Client } = require("pg");

const PORT = Number(process.env.PORT || 8080);
const DATABASE_URL = process.env.DATABASE_URL;

async function checkDatabase() {
  if (!DATABASE_URL) {
    return { ok: false, error: "DATABASE_URL is not set" };
  }

  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    await client.query("SELECT 1");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    await client.end().catch(() => undefined);
  }
}

function json(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function startServer() {
  const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      return json(res, 200, { status: "ok" });
    }

    if (req.method === "GET" && req.url === "/ready") {
      const db = await checkDatabase();
      if (db.ok) {
        return json(res, 200, { status: "ready" });
      }
      return json(res, 503, { status: "not_ready", reason: db.error });
    }

    if (req.method === "GET" && req.url === "/") {
      return json(res, 200, {
        service: "ai-db",
        status: "running",
        endpoints: ["/health", "/ready"]
      });
    }

    return json(res, 404, { error: "not_found" });
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(PORT, () => {
      console.log(`[server] Listening on port ${PORT}`);
      resolve(server);
    });
  });
}

module.exports = { startServer };
