const { runMigrations } = require("./migrate");
const { startServer } = require("./server");

async function start() {
  console.log("[boot] Running migrations...");
  await runMigrations({ maxRetries: 30, delayMs: 2000 });

  console.log("[boot] Starting HTTP server...");
  await startServer();
}

start().catch((err) => {
  console.error(`[boot] Startup failed: ${err.message}`);
  process.exit(1);
});
