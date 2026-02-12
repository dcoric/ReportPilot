const crypto = require("crypto");

function createRequestId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function logEvent(event, data = {}, level = "info") {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...data
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }
  console.log(line);
}

module.exports = {
  createRequestId,
  logEvent
};
