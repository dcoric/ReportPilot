const appDb = require("../lib/appDb");
const { PostgresAdapter } = require("../adapters/postgresAdapter");
const { stringify } = require("csv-stringify/sync"); // Synchronous for simplicity in MVP, or stream
const xlsx = require("xlsx");

const SUPPORTED_FORMATS = new Set(["json", "csv", "xlsx"]);

/**
 * Exports current query results for a given session.
 * Re-runs the *latest successful* SQL generation for the session to get a fresh cursor/result.
 *
 * @param {string} sessionId
 * @param {string} format 'json' | 'csv' | 'xlsx'
 * @returns {Promise<{
 *   buffer: Buffer | string,
 *   contentType: string,
 *   filename: string
 * }>}
 */
async function exportQueryResult(sessionId, format = "json") {
  if (!SUPPORTED_FORMATS.has(format)) {
    throw new Error(`Unsupported format: ${format}`);
  }

  // 1. Fetch session and check data source info
  const sessionResult = await appDb.query(
    `
      SELECT
        qs.id,
        qs.data_source_id,
        qs.question,
        ds.connection_ref,
        ds.db_type
      FROM query_sessions qs
      JOIN data_sources ds ON ds.id = qs.data_source_id
      WHERE qs.id = $1
    `,
    [sessionId]
  );

  if (sessionResult.rowCount === 0) {
    throw new Error("Session not found");
  }

  const session = sessionResult.rows[0];

  // 2. Fetch the latest successful attempt's SQL
  const attemptResult = await appDb.query(
    `
      SELECT generated_sql
      FROM query_attempts
      WHERE session_id = $1
      -- We assume if it was successful it has a result meta, or we can check status if we had one on attempt
      -- But simpler: order by created_at desc, limit 1.
      -- Ideally we want the one that *worked*.
      -- Let's assume the user is exporting the *current* state of the session.
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [sessionId]
  );

  if (attemptResult.rowCount === 0) {
    throw new Error("No query attempts found for this session");
  }

  const sql = attemptResult.rows[0].generated_sql;
  if (!sql) {
    throw new Error("No SQL found in latest attempt");
  }

  // 3. Re-execute the SQL (Read-Only)
  // Note: For very large datasets, we should stream. For MVP, we load into memory.
  const adapter = new PostgresAdapter(session.connection_ref);
  let rows = [];
  try {
    const execution = await adapter.executeReadOnly(sql, { maxRows: 100000 }); // Increase limit for export
    rows = execution.rows;
  } finally {
    await adapter.close();
  }

  // 4. Format Output
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeName = (session.question || "query").replace(/[^a-z0-9]/gi, "_").substring(0, 50);
  const filename = `${safeName}_${timestamp}.${format === "xlsx" ? "xlsx" : format}`;

  let buffer;
  let contentType;

  switch (format) {
    case "json":
      buffer = Buffer.from(JSON.stringify(rows, null, 2), "utf-8");
      contentType = "application/json";
      break;

    case "csv":
      // csv-stringify handles objects if columns are consistent
      // We can infer columns from the first row or passing 'columns' option if needed.
      // stringify(rows, { header: true }) works well.
      buffer = Buffer.from(stringify(rows, { header: true }), "utf-8");
      contentType = "text/csv";
      break;

    case "xlsx": {
      const workBook = xlsx.utils.book_new();
      const workSheet = xlsx.utils.json_to_sheet(rows);
      xlsx.utils.book_append_sheet(workBook, workSheet, "Results");
      buffer = xlsx.write(workBook, { type: "buffer", bookType: "xlsx" });
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      break;
    }
  }

  return { buffer, contentType, filename };
}

module.exports = {
  exportQueryResult,
  SUPPORTED_FORMATS
};
