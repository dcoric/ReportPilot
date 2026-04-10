const fs = require("fs");
const path = require("path");
const appDb = require("./appDb");
const {
  OPENAPI_SPEC_PATH,
  FRONTEND_DIST_PATH,
  FRONTEND_INDEX_PATH,
  STATIC_CONTENT_TYPES
} = require("./constants");

let cachedOpenApiSpec = null;
let cachedFrontendIndex = null;

function loadOpenApiSpec() {
  if (cachedOpenApiSpec === null) {
    cachedOpenApiSpec = fs.readFileSync(OPENAPI_SPEC_PATH, "utf8");
  }
  return cachedOpenApiSpec;
}

function swaggerUiHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Report Pilot API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      SwaggerUIBundle({
        url: "/openapi.yaml",
        dom_id: "#swagger-ui"
      });
    </script>
  </body>
</html>`;
}

function serveSwaggerDocs(res) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(swaggerUiHtml());
}

function serveOpenApiSpec(res) {
  const spec = loadOpenApiSpec();
  res.writeHead(200, { "Content-Type": "application/yaml; charset=utf-8" });
  res.end(spec);
}

function frontendIsAvailable() {
  return fs.existsSync(FRONTEND_INDEX_PATH);
}

function getStaticContentType(filePath) {
  const extname = path.extname(filePath).toLowerCase();
  return STATIC_CONTENT_TYPES[extname] || "application/octet-stream";
}

function isPathWithin(parentPath, candidatePath) {
  const relativePath = path.relative(parentPath, candidatePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function serveFrontendIndex(res) {
  if (!frontendIsAvailable()) {
    return false;
  }

  if (cachedFrontendIndex === null) {
    cachedFrontendIndex = fs.readFileSync(FRONTEND_INDEX_PATH);
  }

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(cachedFrontendIndex);
  return true;
}

function serveFrontendAsset(res, pathname) {
  if (!frontendIsAvailable()) {
    return false;
  }

  const relativeAssetPath = decodeURIComponent(pathname).replace(/^\/+/, "");
  if (!relativeAssetPath) {
    return false;
  }

  const assetPath = path.resolve(FRONTEND_DIST_PATH, relativeAssetPath);
  if (!isPathWithin(FRONTEND_DIST_PATH, assetPath)) {
    return false;
  }

  if (!fs.existsSync(assetPath) || !fs.statSync(assetPath).isFile()) {
    return false;
  }

  const asset = fs.readFileSync(assetPath);
  res.writeHead(200, { "Content-Type": getStaticContentType(assetPath) });
  res.end(asset);
  return true;
}

function shouldServeFrontendApp(req, pathname) {
  if (req.method !== "GET" || !frontendIsAvailable()) {
    return false;
  }

  if (
    pathname === "/health" ||
    pathname === "/ready" ||
    pathname === "/docs" ||
    pathname === "/docs/" ||
    pathname === "/openapi.yaml" ||
    pathname.startsWith("/v1/")
  ) {
    return false;
  }

  if (path.extname(pathname)) {
    return false;
  }

  const accept = String(req.headers.accept || "");
  return accept.includes("text/html");
}

async function checkDatabase() {
  try {
    await appDb.query("SELECT 1");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = {
  serveSwaggerDocs,
  serveOpenApiSpec,
  serveFrontendIndex,
  serveFrontendAsset,
  shouldServeFrontendApp,
  checkDatabase
};
