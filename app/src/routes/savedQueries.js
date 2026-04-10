const appDb = require("../lib/appDb");
const { json, badRequest, readJsonBody } = require("../lib/http");
const { SAVED_QUERY_NAME_MAX_LENGTH, SAVED_QUERY_DESCRIPTION_MAX_LENGTH } = require("../lib/constants");
const {
  isUuid,
  isPgUniqueViolation,
  normalizeOptionalTrimmedString,
  validateSavedQueryDefaultRunParams
} = require("../lib/validation");

async function ensureDataSourceExists(dataSourceId) {
  const sourceResult = await appDb.query("SELECT id FROM data_sources WHERE id = $1", [dataSourceId]);
  return sourceResult.rowCount > 0;
}

async function handleCreateSavedQuery(req, res) {
  const body = await readJsonBody(req);
  const ownerId = String(req.headers["x-user-id"] || "anonymous").trim() || "anonymous";
  const dataSourceId = String(body.data_source_id || "").trim();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const sql = typeof body.sql === "string" ? body.sql.trim() : "";
  const description = normalizeOptionalTrimmedString(body.description);
  const defaultRunParamsValidation = validateSavedQueryDefaultRunParams(body.default_run_params);

  if (!name || !dataSourceId || !sql) {
    return badRequest(res, "name, data_source_id and sql are required");
  }
  if (!isUuid(dataSourceId)) {
    return badRequest(res, "data_source_id must be a valid UUID");
  }
  if (name.length > SAVED_QUERY_NAME_MAX_LENGTH) {
    return badRequest(res, `name cannot exceed ${SAVED_QUERY_NAME_MAX_LENGTH} characters`);
  }
  if (description && description.length > SAVED_QUERY_DESCRIPTION_MAX_LENGTH) {
    return badRequest(res, `description cannot exceed ${SAVED_QUERY_DESCRIPTION_MAX_LENGTH} characters`);
  }
  if (!defaultRunParamsValidation.ok) {
    return badRequest(res, defaultRunParamsValidation.message);
  }

  if (!(await ensureDataSourceExists(dataSourceId))) {
    return json(res, 404, { error: "not_found", message: "Data source not found" });
  }

  try {
    const insertResult = await appDb.query(
      `
        INSERT INTO saved_queries (
          owner_id,
          name,
          description,
          data_source_id,
          sql,
          default_run_params
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
        RETURNING
          id,
          owner_id,
          name,
          description,
          data_source_id,
          sql,
          default_run_params,
          created_at,
          updated_at
      `,
      [ownerId, name, description, dataSourceId, sql, JSON.stringify(defaultRunParamsValidation.value)]
    );

    return json(res, 201, insertResult.rows[0]);
  } catch (err) {
    if (isPgUniqueViolation(err)) {
      return json(res, 409, {
        error: "conflict",
        message: "Saved query name already exists for this owner and data source"
      });
    }
    throw err;
  }
}

async function handleListSavedQueries(_req, res, requestUrl) {
  const dataSourceId = String(requestUrl.searchParams.get("data_source_id") || "").trim();
  if (dataSourceId && !isUuid(dataSourceId)) {
    return badRequest(res, "data_source_id must be a valid UUID");
  }

  const result = await appDb.query(
    `
      SELECT
        id,
        owner_id,
        name,
        description,
        data_source_id,
        sql,
        default_run_params,
        created_at,
        updated_at
      FROM saved_queries
      WHERE ($1::uuid IS NULL OR data_source_id = $1::uuid)
      ORDER BY updated_at DESC, created_at DESC
    `,
    [dataSourceId || null]
  );

  return json(res, 200, { items: result.rows });
}

async function handleGetSavedQuery(_req, res, savedQueryId) {
  if (!isUuid(savedQueryId)) {
    return badRequest(res, "savedQueryId must be a valid UUID");
  }

  const result = await appDb.query(
    `
      SELECT
        id,
        owner_id,
        name,
        description,
        data_source_id,
        sql,
        default_run_params,
        created_at,
        updated_at
      FROM saved_queries
      WHERE id = $1
    `,
    [savedQueryId]
  );

  if (result.rowCount === 0) {
    return json(res, 404, { error: "not_found", message: "Saved query not found" });
  }

  return json(res, 200, result.rows[0]);
}

async function handleUpdateSavedQuery(req, res, savedQueryId) {
  if (!isUuid(savedQueryId)) {
    return badRequest(res, "savedQueryId must be a valid UUID");
  }

  const body = await readJsonBody(req);
  const dataSourceId = String(body.data_source_id || "").trim();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const sql = typeof body.sql === "string" ? body.sql.trim() : "";
  const description = normalizeOptionalTrimmedString(body.description);
  const defaultRunParamsValidation = validateSavedQueryDefaultRunParams(body.default_run_params);

  if (!name || !dataSourceId || !sql) {
    return badRequest(res, "name, data_source_id and sql are required");
  }
  if (!isUuid(dataSourceId)) {
    return badRequest(res, "data_source_id must be a valid UUID");
  }
  if (name.length > SAVED_QUERY_NAME_MAX_LENGTH) {
    return badRequest(res, `name cannot exceed ${SAVED_QUERY_NAME_MAX_LENGTH} characters`);
  }
  if (description && description.length > SAVED_QUERY_DESCRIPTION_MAX_LENGTH) {
    return badRequest(res, `description cannot exceed ${SAVED_QUERY_DESCRIPTION_MAX_LENGTH} characters`);
  }
  if (!defaultRunParamsValidation.ok) {
    return badRequest(res, defaultRunParamsValidation.message);
  }

  if (!(await ensureDataSourceExists(dataSourceId))) {
    return json(res, 404, { error: "not_found", message: "Data source not found" });
  }

  try {
    const updateResult = await appDb.query(
      `
        UPDATE saved_queries
        SET
          name = $2,
          description = $3,
          data_source_id = $4,
          sql = $5,
          default_run_params = $6::jsonb,
          updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          owner_id,
          name,
          description,
          data_source_id,
          sql,
          default_run_params,
          created_at,
          updated_at
      `,
      [savedQueryId, name, description, dataSourceId, sql, JSON.stringify(defaultRunParamsValidation.value)]
    );

    if (updateResult.rowCount === 0) {
      return json(res, 404, { error: "not_found", message: "Saved query not found" });
    }

    return json(res, 200, updateResult.rows[0]);
  } catch (err) {
    if (isPgUniqueViolation(err)) {
      return json(res, 409, {
        error: "conflict",
        message: "Saved query name already exists for this owner and data source"
      });
    }
    throw err;
  }
}

async function handleDeleteSavedQuery(_req, res, savedQueryId) {
  if (!isUuid(savedQueryId)) {
    return badRequest(res, "savedQueryId must be a valid UUID");
  }

  const deleteResult = await appDb.query(
    `
      DELETE FROM saved_queries
      WHERE id = $1
      RETURNING id
    `,
    [savedQueryId]
  );

  if (deleteResult.rowCount === 0) {
    return json(res, 404, { error: "not_found", message: "Saved query not found" });
  }

  return json(res, 200, { ok: true, id: deleteResult.rows[0].id });
}

module.exports = {
  handleCreateSavedQuery,
  handleListSavedQueries,
  handleGetSavedQuery,
  handleUpdateSavedQuery,
  handleDeleteSavedQuery
};
