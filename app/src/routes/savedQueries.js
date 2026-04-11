const appDb = require("../lib/appDb");
const { json, badRequest, readJsonBody } = require("../lib/http");
const { SAVED_QUERY_NAME_MAX_LENGTH, SAVED_QUERY_DESCRIPTION_MAX_LENGTH } = require("../lib/constants");
const {
  clamp,
  isUuid,
  isPgUniqueViolation,
  normalizeOptionalTrimmedString,
  validateSavedQueryDefaultRunParams
} = require("../lib/validation");
const { createDatabaseAdapter, isSupportedDbType } = require("../adapters/dbAdapterFactory");
const { validateAndNormalizeSql, sanitizeGeneratedSql, ensureLimit } = require("../services/sqlSafety");
const {
  extractPlaceholders,
  buildParameterSchemaFromPlaceholders
} = require("../services/queryParameterParser");
const {
  validateParameterSchema,
  validateParameterValues,
  substitutePlaceholdersForValidation
} = require("../services/queryParameterService");

async function ensureDataSourceExists(dataSourceId) {
  const sourceResult = await appDb.query("SELECT id FROM data_sources WHERE id = $1", [dataSourceId]);
  return sourceResult.rowCount > 0;
}

async function loadSavedQuery(savedQueryId) {
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
        parameter_schema,
        created_at,
        updated_at
      FROM saved_queries
      WHERE id = $1
    `,
    [savedQueryId]
  );

  return result.rows[0] || null;
}

async function loadSavedQueryForExecution(savedQueryId) {
  const result = await appDb.query(
    `
      SELECT
        sq.id,
        sq.owner_id,
        sq.name,
        sq.description,
        sq.data_source_id,
        sq.sql,
        sq.default_run_params,
        sq.parameter_schema,
        sq.created_at,
        sq.updated_at,
        ds.connection_ref,
        ds.db_type
      FROM saved_queries sq
      JOIN data_sources ds ON ds.id = sq.data_source_id
      WHERE sq.id = $1
    `,
    [savedQueryId]
  );

  return result.rows[0] || null;
}

async function loadSchemaObjects(dataSourceId) {
  const result = await appDb.query(
    `
      SELECT schema_name, object_name
      FROM schema_objects
      WHERE data_source_id = $1
        AND is_ignored = FALSE
        AND object_type IN ('table', 'view', 'materialized_view')
    `,
    [dataSourceId]
  );

  return result.rows;
}

function resolveParameterSchema(sql, providedParameterSchema, existingSchema) {
  const placeholders = extractPlaceholders(sql);

  if (providedParameterSchema === undefined) {
    return {
      ok: true,
      value: buildParameterSchemaFromPlaceholders(placeholders, existingSchema)
    };
  }

  const schemaValidation = validateParameterSchema(providedParameterSchema);
  if (!schemaValidation.ok) {
    return schemaValidation;
  }

  return {
    ok: true,
    value: buildParameterSchemaFromPlaceholders(placeholders, schemaValidation.value)
  };
}

function resolveSavedQueryRunOptions(defaultRunParams, body) {
  const merged = {
    max_rows: defaultRunParams?.max_rows,
    timeout_ms: defaultRunParams?.timeout_ms
  };

  if (Object.prototype.hasOwnProperty.call(body || {}, "max_rows")) {
    merged.max_rows = body.max_rows;
  }
  if (Object.prototype.hasOwnProperty.call(body || {}, "timeout_ms")) {
    merged.timeout_ms = body.timeout_ms;
  }

  const maxRows = Number(merged.max_rows);
  const timeoutMs = Number(merged.timeout_ms);

  return {
    maxRows: clamp(Number.isFinite(maxRows) ? maxRows : 1000, 1, 100000),
    timeoutMs: clamp(Number.isFinite(timeoutMs) ? timeoutMs : 20000, 1000, 120000)
  };
}

async function handleCreateSavedQuery(req, res) {
  const body = await readJsonBody(req);
  const ownerId = String(req.headers["x-user-id"] || "anonymous").trim() || "anonymous";
  const dataSourceId = String(body.data_source_id || "").trim();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const sql = typeof body.sql === "string" ? body.sql.trim() : "";
  const description = normalizeOptionalTrimmedString(body.description);
  const defaultRunParamsValidation = validateSavedQueryDefaultRunParams(body.default_run_params);
  const parameterSchemaValidation = resolveParameterSchema(sql, body.parameter_schema, []);

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
  if (!parameterSchemaValidation.ok) {
    return badRequest(res, parameterSchemaValidation.message);
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
          default_run_params,
          parameter_schema
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
        RETURNING
          id,
          owner_id,
          name,
          description,
          data_source_id,
          sql,
          default_run_params,
          parameter_schema,
          created_at,
          updated_at
      `,
      [
        ownerId,
        name,
        description,
        dataSourceId,
        sql,
        JSON.stringify(defaultRunParamsValidation.value),
        JSON.stringify(parameterSchemaValidation.value)
      ]
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
        parameter_schema,
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

  const savedQuery = await loadSavedQuery(savedQueryId);
  if (!savedQuery) {
    return json(res, 404, { error: "not_found", message: "Saved query not found" });
  }

  return json(res, 200, savedQuery);
}

async function handleUpdateSavedQuery(req, res, savedQueryId) {
  if (!isUuid(savedQueryId)) {
    return badRequest(res, "savedQueryId must be a valid UUID");
  }

  const body = await readJsonBody(req);
  const existingSavedQuery = await loadSavedQuery(savedQueryId);
  if (!existingSavedQuery) {
    return json(res, 404, { error: "not_found", message: "Saved query not found" });
  }

  const dataSourceId = String(body.data_source_id || "").trim();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const sql = typeof body.sql === "string" ? body.sql.trim() : "";
  const description = normalizeOptionalTrimmedString(body.description);
  const defaultRunParamsValidation = validateSavedQueryDefaultRunParams(body.default_run_params);
  const parameterSchemaValidation = resolveParameterSchema(sql, body.parameter_schema, existingSavedQuery.parameter_schema);

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
  if (!parameterSchemaValidation.ok) {
    return badRequest(res, parameterSchemaValidation.message);
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
          parameter_schema = $7::jsonb,
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
          parameter_schema,
          created_at,
          updated_at
      `,
      [
        savedQueryId,
        name,
        description,
        dataSourceId,
        sql,
        JSON.stringify(defaultRunParamsValidation.value),
        JSON.stringify(parameterSchemaValidation.value)
      ]
    );

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

async function handleValidateParams(req, res, savedQueryId) {
  if (!isUuid(savedQueryId)) {
    return badRequest(res, "savedQueryId must be a valid UUID");
  }

  const savedQuery = await loadSavedQuery(savedQueryId);
  if (!savedQuery) {
    return json(res, 404, { error: "not_found", message: "Saved query not found" });
  }

  const body = await readJsonBody(req);
  const validation = validateParameterValues(savedQuery.parameter_schema, body.params);
  if (!validation.ok) {
    return json(res, 200, { ok: false, errors: validation.errors });
  }

  return json(res, 200, { ok: true, resolved_values: validation.resolvedValues });
}

async function handleRunSavedQuery(req, res, savedQueryId) {
  if (!isUuid(savedQueryId)) {
    return badRequest(res, "savedQueryId must be a valid UUID");
  }

  const savedQuery = await loadSavedQueryForExecution(savedQueryId);
  if (!savedQuery) {
    return json(res, 404, { error: "not_found", message: "Saved query not found" });
  }
  if (!isSupportedDbType(savedQuery.db_type)) {
    return badRequest(res, `Unsupported db_type for execution: ${savedQuery.db_type}`);
  }

  const body = await readJsonBody(req);
  const parameterValidation = validateParameterValues(savedQuery.parameter_schema, body.params);
  if (!parameterValidation.ok) {
    return json(res, 400, {
      error: "bad_request",
      message: "Invalid saved query parameters",
      errors: parameterValidation.errors
    });
  }

  const dialect = savedQuery.db_type === "mssql" ? "mssql" : "postgres";
  const { maxRows, timeoutMs } = resolveSavedQueryRunOptions(savedQuery.default_run_params, body);
  const executableSql = ensureLimit(sanitizeGeneratedSql(savedQuery.sql), maxRows, dialect);
  const schemaObjects = await loadSchemaObjects(savedQuery.data_source_id);
  const validationSql = substitutePlaceholdersForValidation(executableSql, savedQuery.parameter_schema);
  const normalized = validateAndNormalizeSql(validationSql, {
    maxRows,
    schemaObjects,
    dialect
  });

  if (!normalized.ok) {
    return json(res, 400, {
      error: "bad_request",
      message: normalized.errors.join("; "),
      errors: normalized.errors
    });
  }

  let adapter = null;
  try {
    adapter = createDatabaseAdapter(savedQuery.db_type, savedQuery.connection_ref);
    const adapterValidation = await adapter.validateSql(normalized.sql);
    if (!adapterValidation.ok) {
      return json(res, 400, {
        error: "bad_request",
        message: adapterValidation.errors.join("; "),
        errors: adapterValidation.errors
      });
    }

    const execution = await adapter.executeParameterizedReadOnly(
      executableSql,
      parameterValidation.resolvedValues,
      savedQuery.parameter_schema,
      { maxRows, timeoutMs }
    );

    return json(res, 200, {
      sql: executableSql,
      columns: execution.columns,
      rows: execution.rows,
      row_count: execution.rowCount,
      duration_ms: execution.durationMs
    });
  } finally {
    if (adapter) {
      await adapter.close();
    }
  }
}

module.exports = {
  handleCreateSavedQuery,
  handleListSavedQueries,
  handleGetSavedQuery,
  handleUpdateSavedQuery,
  handleDeleteSavedQuery,
  handleValidateParams,
  handleRunSavedQuery
};
