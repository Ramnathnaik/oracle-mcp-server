import { connectionManager } from "./connection.js";

type Row = Record<string, unknown>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function schemaFilter(
  schema?: string,
  ownerColumn = "OWNER",
  currentUser = false
): string {
  if (schema) return `AND ${ownerColumn} = UPPER('${esc(schema)}')`;
  if (currentUser) return `AND ${ownerColumn} = USER`;
  return "";
}

function esc(s: string): string {
  return s.replace(/'/g, "''");
}

function likeFilter(
  column: string,
  pattern?: string
): string {
  return pattern ? `AND ${column} LIKE UPPER('${esc(pattern)}')` : "";
}

function blockWriteStatements(sql: string): void {
  const upper = sql.trim().toUpperCase();
  const blocked = [
    "INSERT",
    "UPDATE",
    "DELETE",
    "MERGE",
    "DROP",
    "CREATE",
    "ALTER",
    "TRUNCATE",
    "GRANT",
    "REVOKE",
    "EXEC",
    "EXECUTE",
    "BEGIN",
    "CALL",
  ];
  for (const kw of blocked) {
    if (upper.startsWith(kw)) {
      throw new Error(
        `Write/DDL operations are not permitted. Blocked keyword: ${kw}`
      );
    }
  }
  if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) {
    throw new Error("Only SELECT statements (or CTEs starting with WITH) are allowed.");
  }
}

function formatRows(rows: Row[]): string {
  if (rows.length === 0) return "No rows found.";
  return JSON.stringify(rows, null, 2);
}

// ─── Handler map ──────────────────────────────────────────────────────────────

export async function handleTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  switch (name) {
    // ── Connection ──────────────────────────────────────────────
    case "oracle_connect":
      return handleConnect(args);
    case "oracle_connection_status":
      return handleConnectionStatus();

    // ── Tables & Views ──────────────────────────────────────────
    case "oracle_list_tables":
      return handleListTables(args);
    case "oracle_describe_table":
      return handleDescribeTable(args);
    case "oracle_list_views":
      return handleListViews(args);
    case "oracle_get_view_definition":
      return handleGetViewDefinition(args);

    // ── Data ────────────────────────────────────────────────────
    case "oracle_query_table":
      return handleQueryTable(args);
    case "oracle_execute_query":
      return handleExecuteQuery(args);
    case "oracle_get_table_row_count":
      return handleGetTableRowCount(args);

    // ── Constraints & Indexes ───────────────────────────────────
    case "oracle_list_constraints":
      return handleListConstraints(args);
    case "oracle_list_indexes":
      return handleListIndexes(args);

    // ── Stored Objects ──────────────────────────────────────────
    case "oracle_list_procedures":
      return handleListProcedures(args);
    case "oracle_get_procedure_source":
      return handleGetProcedureSource(args);
    case "oracle_list_packages":
      return handleListPackages(args);
    case "oracle_get_package_source":
      return handleGetPackageSource(args);
    case "oracle_list_triggers":
      return handleListTriggers(args);
    case "oracle_get_trigger_source":
      return handleGetTriggerSource(args);

    // ── Sequences ───────────────────────────────────────────────
    case "oracle_list_sequences":
      return handleListSequences(args);
    case "oracle_describe_sequence":
      return handleDescribeSequence(args);

    // ── Synonyms ────────────────────────────────────────────────
    case "oracle_list_synonyms":
      return handleListSynonyms(args);

    // ── DB Links ────────────────────────────────────────────────
    case "oracle_list_db_links":
      return handleListDbLinks(args);

    // ── Tablespaces ─────────────────────────────────────────────
    case "oracle_list_tablespaces":
      return handleListTablespaces();

    // ── Schema ──────────────────────────────────────────────────
    case "oracle_list_schemas":
      return handleListSchemas(args);
    case "oracle_schema_summary":
      return handleSchemaSummary(args);
    case "oracle_list_object_types":
      return handleListObjectTypes(args);

    // ── Columns ─────────────────────────────────────────────────
    case "oracle_search_columns":
      return handleSearchColumns(args);

    // ── DB/Session Info ─────────────────────────────────────────
    case "oracle_database_info":
      return handleDatabaseInfo();
    case "oracle_current_session":
      return handleCurrentSession();

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── Implementations ──────────────────────────────────────────────────────────

async function handleConnect(args: Record<string, unknown>): Promise<string> {
  const { connectionString, username, password } = args as {
    connectionString: string;
    username: string;
    password: string;
  };
  await connectionManager.initialize({ connectionString, username, password });
  // Quick smoke-test query
  await connectionManager.execute("SELECT 1 FROM DUAL");
  return `✅ Successfully connected to Oracle database at "${connectionString}" as "${username}".`;
}

async function handleConnectionStatus(): Promise<string> {
  const cfg = connectionManager.getConfig();
  if (!cfg) return "❌ Not connected. Use oracle_connect first.";
  const ok = await connectionManager.isConnected();
  return ok
    ? `✅ Connected to "${cfg.connectionString}" as "${cfg.username}".`
    : `❌ Connection to "${cfg.connectionString}" is unavailable.`;
}

async function handleListTables(args: Record<string, unknown>): Promise<string> {
  const { schema, pattern, includeSystemTables } = args as {
    schema?: string;
    pattern?: string;
    includeSystemTables?: boolean;
  };

  const systemExclude = includeSystemTables
    ? ""
    : `AND OWNER NOT IN ('SYS','SYSTEM','MDSYS','CTXSYS','WMSYS','EXFSYS',
        'ORDSYS','ORDDATA','XDB','APEX_050000','APEX_030200','FLOWS_FILES',
        'HR','OE','PM','IX','SH','BI','SYSMAN','DBSNMP','OUTLN','ANONYMOUS')`;

  const sql = `
    SELECT OWNER, TABLE_NAME, NUM_ROWS, TABLESPACE_NAME, STATUS,
           LAST_ANALYZED
    FROM   ALL_TABLES
    WHERE  1=1
    ${schemaFilter(schema)}
    ${likeFilter("TABLE_NAME", pattern)}
    ${systemExclude}
    ORDER  BY OWNER, TABLE_NAME
  `;
  const rows = await connectionManager.execute<Row>(sql);
  return `Found ${rows.length} table(s).\n${formatRows(rows)}`;
}

async function handleDescribeTable(
  args: Record<string, unknown>
): Promise<string> {
  const { tableName, schema } = args as {
    tableName: string;
    schema?: string;
  };
  const ownerCond = schema
    ? `AND c.OWNER = UPPER('${esc(schema)}')`
    : `AND c.OWNER = USER`;

  const colsSql = `
    SELECT c.COLUMN_NAME, c.DATA_TYPE, c.DATA_LENGTH, c.DATA_PRECISION,
           c.DATA_SCALE, c.NULLABLE, c.DATA_DEFAULT, c.COLUMN_ID,
           cc.COMMENTS
    FROM   ALL_TAB_COLUMNS c
    LEFT   JOIN ALL_COL_COMMENTS cc
           ON cc.OWNER = c.OWNER
           AND cc.TABLE_NAME = c.TABLE_NAME
           AND cc.COLUMN_NAME = c.COLUMN_NAME
    WHERE  c.TABLE_NAME = UPPER('${esc(tableName)}')
    ${ownerCond}
    ORDER  BY c.COLUMN_ID
  `;

  const tableSql = `
    SELECT OWNER, TABLE_NAME, NUM_ROWS, TABLESPACE_NAME,
           LAST_ANALYZED, STATUS, COMMENTS
    FROM (
      SELECT t.OWNER, t.TABLE_NAME, t.NUM_ROWS, t.TABLESPACE_NAME,
             t.LAST_ANALYZED, t.STATUS, tc.COMMENTS
      FROM   ALL_TABLES t
      LEFT   JOIN ALL_TAB_COMMENTS tc
             ON tc.OWNER = t.OWNER AND tc.TABLE_NAME = t.TABLE_NAME
      WHERE  t.TABLE_NAME = UPPER('${esc(tableName)}')
      ${ownerCond}
    )
  `;

  const [columns, tableInfo] = await Promise.all([
    connectionManager.execute<Row>(colsSql),
    connectionManager.execute<Row>(tableSql),
  ]);

  return JSON.stringify({ tableInfo: tableInfo[0] ?? {}, columns }, null, 2);
}

async function handleListViews(args: Record<string, unknown>): Promise<string> {
  const { schema, pattern } = args as { schema?: string; pattern?: string };
  const sql = `
    SELECT OWNER, VIEW_NAME, TEXT_LENGTH, STATUS
    FROM   ALL_VIEWS
    WHERE  1=1
    ${schemaFilter(schema)}
    ${likeFilter("VIEW_NAME", pattern)}
    ORDER  BY OWNER, VIEW_NAME
  `;
  const rows = await connectionManager.execute<Row>(sql);
  return `Found ${rows.length} view(s).\n${formatRows(rows)}`;
}

async function handleGetViewDefinition(
  args: Record<string, unknown>
): Promise<string> {
  const { viewName, schema } = args as { viewName: string; schema?: string };
  const sql = `
    SELECT OWNER, VIEW_NAME, TEXT
    FROM   ALL_VIEWS
    WHERE  VIEW_NAME = UPPER('${esc(viewName)}')
    ${schemaFilter(schema)}
  `;
  const rows = await connectionManager.execute<Row>(sql);
  if (!rows.length) return `View "${viewName}" not found.`;
  return JSON.stringify(rows[0], null, 2);
}

async function handleQueryTable(
  args: Record<string, unknown>
): Promise<string> {
  const {
    tableName,
    schema,
    columns,
    whereClause,
    orderBy,
    limit = 100,
    offset = 0,
  } = args as {
    tableName: string;
    schema?: string;
    columns?: string[];
    whereClause?: string;
    orderBy?: string;
    limit?: number;
    offset?: number;
  };

  const maxLimit = Math.min(Number(limit), 1000);
  const colList =
    columns && columns.length > 0 ? columns.join(", ") : "*";
  const fullTable = schema
    ? `${schema.toUpperCase()}.${tableName.toUpperCase()}`
    : tableName.toUpperCase();
  const where = whereClause ? `WHERE ${whereClause}` : "";
  const order = orderBy ? `ORDER BY ${orderBy}` : "";

  const sql = `
    SELECT ${colList}
    FROM   ${fullTable}
    ${where}
    ${order}
    FETCH FIRST ${maxLimit} ROWS ONLY
    ${offset > 0 ? `OFFSET ${offset} ROWS` : ""}
  `;

  const rows = await connectionManager.execute<Row>(sql);
  return `Returned ${rows.length} row(s).\n${formatRows(rows)}`;
}

async function handleExecuteQuery(
  args: Record<string, unknown>
): Promise<string> {
  const { sql, limit = 100 } = args as { sql: string; limit?: number };
  blockWriteStatements(sql);
  const maxLimit = Math.min(Number(limit), 1000);
  // Wrap in row-limited subquery
  const wrapped = `SELECT * FROM (${sql}) WHERE ROWNUM <= ${maxLimit}`;
  const rows = await connectionManager.execute<Row>(wrapped);
  return `Returned ${rows.length} row(s).\n${formatRows(rows)}`;
}

async function handleGetTableRowCount(
  args: Record<string, unknown>
): Promise<string> {
  const { tableNames, schema } = args as {
    tableNames: string[];
    schema?: string;
  };
  const results: Record<string, number | string> = {};
  for (const t of tableNames) {
    try {
      const fullTable = schema
        ? `${schema.toUpperCase()}.${t.toUpperCase()}`
        : t.toUpperCase();
      const rows = await connectionManager.execute<Row>(
        `SELECT COUNT(*) AS CNT FROM ${fullTable}`
      );
      results[t] = (rows[0]?.CNT as number) ?? 0;
    } catch (e) {
      results[t] = `Error: ${(e as Error).message}`;
    }
  }
  return JSON.stringify(results, null, 2);
}

async function handleListConstraints(
  args: Record<string, unknown>
): Promise<string> {
  const { tableName, schema, constraintType = "ALL" } = args as {
    tableName: string;
    schema?: string;
    constraintType?: string;
  };
  const typeCond =
    constraintType !== "ALL"
      ? `AND c.CONSTRAINT_TYPE = '${esc(constraintType)}'`
      : "";

  const sql = `
    SELECT c.OWNER, c.CONSTRAINT_NAME, c.CONSTRAINT_TYPE,
           c.STATUS, c.VALIDATED, c.RELY,
           cc.COLUMN_NAME, cc.POSITION,
           c.R_OWNER, c.R_CONSTRAINT_NAME, c.SEARCH_CONDITION,
           c.DELETE_RULE
    FROM   ALL_CONSTRAINTS c
    JOIN   ALL_CONS_COLUMNS cc
           ON cc.OWNER = c.OWNER
           AND cc.CONSTRAINT_NAME = c.CONSTRAINT_NAME
    WHERE  c.TABLE_NAME = UPPER('${esc(tableName)}')
    ${schemaFilter(schema, "c.OWNER")}
    ${typeCond}
    ORDER  BY c.CONSTRAINT_TYPE, c.CONSTRAINT_NAME, cc.POSITION
  `;
  const rows = await connectionManager.execute<Row>(sql);
  return `Found ${rows.length} constraint column(s).\n${formatRows(rows)}`;
}

async function handleListIndexes(
  args: Record<string, unknown>
): Promise<string> {
  const { tableName, schema } = args as {
    tableName: string;
    schema?: string;
  };
  const sql = `
    SELECT i.OWNER, i.INDEX_NAME, i.INDEX_TYPE, i.UNIQUENESS,
           i.STATUS, i.TABLESPACE_NAME, ic.COLUMN_NAME, ic.COLUMN_POSITION,
           ic.DESCEND
    FROM   ALL_INDEXES i
    JOIN   ALL_IND_COLUMNS ic
           ON ic.INDEX_OWNER = i.OWNER AND ic.INDEX_NAME = i.INDEX_NAME
    WHERE  i.TABLE_NAME = UPPER('${esc(tableName)}')
    ${schemaFilter(schema, "i.OWNER")}
    ORDER  BY i.INDEX_NAME, ic.COLUMN_POSITION
  `;
  const rows = await connectionManager.execute<Row>(sql);
  return `Found ${rows.length} index column(s).\n${formatRows(rows)}`;
}

async function handleListProcedures(
  args: Record<string, unknown>
): Promise<string> {
  const { schema, pattern, objectType = "ALL" } = args as {
    schema?: string;
    pattern?: string;
    objectType?: string;
  };
  const typeCond =
    objectType !== "ALL"
      ? `AND OBJECT_TYPE = '${esc(objectType)}'`
      : `AND OBJECT_TYPE IN ('PROCEDURE','FUNCTION')`;

  const sql = `
    SELECT OWNER, OBJECT_NAME, OBJECT_TYPE, STATUS, LAST_DDL_TIME
    FROM   ALL_OBJECTS
    WHERE  1=1
    ${schemaFilter(schema)}
    ${likeFilter("OBJECT_NAME", pattern)}
    ${typeCond}
    ORDER  BY OWNER, OBJECT_TYPE, OBJECT_NAME
  `;
  const rows = await connectionManager.execute<Row>(sql);
  return `Found ${rows.length} procedure/function(s).\n${formatRows(rows)}`;
}

async function handleGetProcedureSource(
  args: Record<string, unknown>
): Promise<string> {
  const { objectName, schema, objectType = "PROCEDURE" } = args as {
    objectName: string;
    schema?: string;
    objectType?: string;
  };
  const sql = `
    SELECT OWNER, NAME, TYPE, LINE, TEXT
    FROM   ALL_SOURCE
    WHERE  NAME = UPPER('${esc(objectName)}')
    AND    TYPE = '${esc(objectType)}'
    ${schemaFilter(schema)}
    ORDER  BY LINE
  `;
  const rows = await connectionManager.execute<Row>(sql);
  if (!rows.length) return `Source not found for ${objectType} "${objectName}".`;
  const source = rows.map((r) => r.TEXT as string).join("");
  const owner = rows[0].OWNER;
  return `-- ${objectType}: ${owner}.${objectName}\n${source}`;
}

async function handleListPackages(
  args: Record<string, unknown>
): Promise<string> {
  const { schema, pattern } = args as { schema?: string; pattern?: string };
  const sql = `
    SELECT OWNER, OBJECT_NAME, OBJECT_TYPE, STATUS, LAST_DDL_TIME
    FROM   ALL_OBJECTS
    WHERE  OBJECT_TYPE IN ('PACKAGE','PACKAGE BODY')
    ${schemaFilter(schema)}
    ${likeFilter("OBJECT_NAME", pattern)}
    ORDER  BY OWNER, OBJECT_NAME, OBJECT_TYPE
  `;
  const rows = await connectionManager.execute<Row>(sql);
  return `Found ${rows.length} package object(s).\n${formatRows(rows)}`;
}

async function handleGetPackageSource(
  args: Record<string, unknown>
): Promise<string> {
  const { packageName, schema, part = "ALL" } = args as {
    packageName: string;
    schema?: string;
    part?: string;
  };
  let typeCond = `AND TYPE IN ('PACKAGE','PACKAGE BODY')`;
  if (part === "SPEC") typeCond = `AND TYPE = 'PACKAGE'`;
  if (part === "BODY") typeCond = `AND TYPE = 'PACKAGE BODY'`;

  const sql = `
    SELECT TYPE, LINE, TEXT
    FROM   ALL_SOURCE
    WHERE  NAME = UPPER('${esc(packageName)}')
    ${typeCond}
    ${schemaFilter(schema)}
    ORDER  BY TYPE, LINE
  `;
  const rows = await connectionManager.execute<Row>(sql);
  if (!rows.length) return `Package "${packageName}" not found.`;
  const source = rows.map((r) => r.TEXT as string).join("");
  return `-- PACKAGE: ${packageName} (${part})\n${source}`;
}

async function handleListTriggers(
  args: Record<string, unknown>
): Promise<string> {
  const { schema, tableName, pattern } = args as {
    schema?: string;
    tableName?: string;
    pattern?: string;
  };
  const tableCond = tableName
    ? `AND TABLE_NAME = UPPER('${esc(tableName)}')`
    : "";
  const sql = `
    SELECT OWNER, TRIGGER_NAME, TRIGGER_TYPE, TRIGGERING_EVENT,
           TABLE_OWNER, TABLE_NAME, STATUS, ACTION_TYPE
    FROM   ALL_TRIGGERS
    WHERE  1=1
    ${schemaFilter(schema)}
    ${tableCond}
    ${likeFilter("TRIGGER_NAME", pattern)}
    ORDER  BY OWNER, TRIGGER_NAME
  `;
  const rows = await connectionManager.execute<Row>(sql);
  return `Found ${rows.length} trigger(s).\n${formatRows(rows)}`;
}

async function handleGetTriggerSource(
  args: Record<string, unknown>
): Promise<string> {
  const { triggerName, schema } = args as {
    triggerName: string;
    schema?: string;
  };
  const sql = `
    SELECT OWNER, TRIGGER_NAME, TRIGGER_TYPE, TRIGGERING_EVENT,
           TABLE_OWNER, TABLE_NAME, STATUS, TRIGGER_BODY
    FROM   ALL_TRIGGERS
    WHERE  TRIGGER_NAME = UPPER('${esc(triggerName)}')
    ${schemaFilter(schema)}
  `;
  const rows = await connectionManager.execute<Row>(sql);
  if (!rows.length) return `Trigger "${triggerName}" not found.`;
  return JSON.stringify(rows[0], null, 2);
}

async function handleListSequences(
  args: Record<string, unknown>
): Promise<string> {
  const { schema, pattern } = args as { schema?: string; pattern?: string };
  const sql = `
    SELECT SEQUENCE_OWNER, SEQUENCE_NAME, MIN_VALUE, MAX_VALUE,
           INCREMENT_BY, CYCLE_FLAG, ORDER_FLAG, CACHE_SIZE, LAST_NUMBER
    FROM   ALL_SEQUENCES
    WHERE  1=1
    ${schemaFilter(schema, "SEQUENCE_OWNER")}
    ${likeFilter("SEQUENCE_NAME", pattern)}
    ORDER  BY SEQUENCE_OWNER, SEQUENCE_NAME
  `;
  const rows = await connectionManager.execute<Row>(sql);
  return `Found ${rows.length} sequence(s).\n${formatRows(rows)}`;
}

async function handleDescribeSequence(
  args: Record<string, unknown>
): Promise<string> {
  const { sequenceName, schema } = args as {
    sequenceName: string;
    schema?: string;
  };
  const sql = `
    SELECT SEQUENCE_OWNER, SEQUENCE_NAME, MIN_VALUE, MAX_VALUE,
           INCREMENT_BY, CYCLE_FLAG, ORDER_FLAG, CACHE_SIZE, LAST_NUMBER
    FROM   ALL_SEQUENCES
    WHERE  SEQUENCE_NAME = UPPER('${esc(sequenceName)}')
    ${schemaFilter(schema, "SEQUENCE_OWNER")}
  `;
  const rows = await connectionManager.execute<Row>(sql);
  if (!rows.length) return `Sequence "${sequenceName}" not found.`;
  return JSON.stringify(rows[0], null, 2);
}

async function handleListSynonyms(
  args: Record<string, unknown>
): Promise<string> {
  const { schema, pattern, synonymType = "ALL" } = args as {
    schema?: string;
    pattern?: string;
    synonymType?: string;
  };

  let sql: string;
  if (synonymType === "PUBLIC" || (!schema && synonymType === "ALL")) {
    const publicPart = `
      SELECT 'PUBLIC' AS SYNONYM_TYPE, SYNONYM_NAME, TABLE_OWNER,
             TABLE_NAME, DB_LINK
      FROM   ALL_SYNONYMS
      WHERE  OWNER = 'PUBLIC'
      ${likeFilter("SYNONYM_NAME", pattern)}
    `;
    const privatePart = `
      SELECT 'PRIVATE' AS SYNONYM_TYPE, SYNONYM_NAME, TABLE_OWNER,
             TABLE_NAME, DB_LINK
      FROM   ALL_SYNONYMS
      WHERE  OWNER != 'PUBLIC'
      ${schemaFilter(schema)}
      ${likeFilter("SYNONYM_NAME", pattern)}
    `;
    if (synonymType === "PUBLIC") {
      sql = `${publicPart} ORDER BY SYNONYM_NAME`;
    } else {
      sql = `${publicPart} UNION ALL ${privatePart} ORDER BY SYNONYM_TYPE, SYNONYM_NAME`;
    }
  } else {
    sql = `
      SELECT 'PRIVATE' AS SYNONYM_TYPE, SYNONYM_NAME, TABLE_OWNER,
             TABLE_NAME, DB_LINK
      FROM   ALL_SYNONYMS
      WHERE  OWNER != 'PUBLIC'
      ${schemaFilter(schema)}
      ${likeFilter("SYNONYM_NAME", pattern)}
      ORDER  BY SYNONYM_NAME
    `;
  }
  const rows = await connectionManager.execute<Row>(sql);
  return `Found ${rows.length} synonym(s).\n${formatRows(rows)}`;
}

async function handleListDbLinks(
  args: Record<string, unknown>
): Promise<string> {
  const { schema } = args as { schema?: string };
  const sql = `
    SELECT OWNER, DB_LINK, USERNAME, HOST, CREATED
    FROM   ALL_DB_LINKS
    WHERE  1=1
    ${schemaFilter(schema)}
    ORDER  BY OWNER, DB_LINK
  `;
  const rows = await connectionManager.execute<Row>(sql);
  return `Found ${rows.length} database link(s).\n${formatRows(rows)}`;
}

async function handleListTablespaces(): Promise<string> {
  const sql = `
    SELECT t.TABLESPACE_NAME, t.STATUS, t.CONTENTS, t.LOGGING,
           t.EXTENT_MANAGEMENT, t.SEGMENT_SPACE_MANAGEMENT,
           ROUND(NVL(f.BYTES/1024/1024,0),2)  AS FREE_MB,
           ROUND(NVL(d.BYTES/1024/1024,0),2)  AS TOTAL_MB
    FROM   DBA_TABLESPACES t
    LEFT   JOIN (SELECT TABLESPACE_NAME, SUM(BYTES) BYTES
                 FROM   DBA_FREE_SPACE GROUP BY TABLESPACE_NAME) f
           ON f.TABLESPACE_NAME = t.TABLESPACE_NAME
    LEFT   JOIN (SELECT TABLESPACE_NAME, SUM(BYTES) BYTES
                 FROM   DBA_DATA_FILES GROUP BY TABLESPACE_NAME) d
           ON d.TABLESPACE_NAME = t.TABLESPACE_NAME
    ORDER  BY t.TABLESPACE_NAME
  `;
  try {
    const rows = await connectionManager.execute<Row>(sql);
    return `Found ${rows.length} tablespace(s).\n${formatRows(rows)}`;
  } catch {
    // Fall back to USER_TABLESPACES if no DBA access
    const fallbackSql = `
      SELECT TABLESPACE_NAME, STATUS, CONTENTS, LOGGING,
             EXTENT_MANAGEMENT, SEGMENT_SPACE_MANAGEMENT
      FROM   USER_TABLESPACES
      ORDER  BY TABLESPACE_NAME
    `;
    const rows = await connectionManager.execute<Row>(fallbackSql);
    return `Found ${rows.length} tablespace(s) (limited view - no DBA access).\n${formatRows(rows)}`;
  }
}

async function handleListSchemas(
  args: Record<string, unknown>
): Promise<string> {
  const { pattern, includeSystem = false } = args as {
    pattern?: string;
    includeSystem?: boolean;
  };
  const systemExclude = includeSystem
    ? ""
    : `AND USERNAME NOT IN ('SYS','SYSTEM','MDSYS','CTXSYS','WMSYS','EXFSYS',
        'ORDSYS','ORDDATA','XDB','ANONYMOUS','DBSNMP','OUTLN','SYSMAN')`;

  const sql = `
    SELECT USERNAME, ACCOUNT_STATUS, CREATED, DEFAULT_TABLESPACE,
           PROFILE
    FROM   ALL_USERS
    WHERE  1=1
    ${likeFilter("USERNAME", pattern)}
    ${systemExclude}
    ORDER  BY USERNAME
  `;
  const rows = await connectionManager.execute<Row>(sql);
  return `Found ${rows.length} schema(s).\n${formatRows(rows)}`;
}

async function handleSchemaSummary(
  args: Record<string, unknown>
): Promise<string> {
  const { schema } = args as { schema?: string };
  const ownerCond = schema
    ? `OWNER = UPPER('${esc(schema)}')`
    : `OWNER = USER`;

  const sql = `
    SELECT OBJECT_TYPE, COUNT(*) AS COUNT
    FROM   ALL_OBJECTS
    WHERE  ${ownerCond}
    GROUP  BY OBJECT_TYPE
    ORDER  BY OBJECT_TYPE
  `;
  const rows = await connectionManager.execute<Row>(sql);
  return `Schema summary for "${schema ?? "current user"}":\n${formatRows(rows)}`;
}

async function handleListObjectTypes(
  args: Record<string, unknown>
): Promise<string> {
  const { schema } = args as { schema?: string };
  const sql = `
    SELECT DISTINCT OBJECT_TYPE
    FROM   ALL_OBJECTS
    WHERE  ${schema ? `OWNER = UPPER('${esc(schema)}')` : `OWNER = USER`}
    ORDER  BY OBJECT_TYPE
  `;
  const rows = await connectionManager.execute<Row>(sql);
  return formatRows(rows);
}

async function handleSearchColumns(
  args: Record<string, unknown>
): Promise<string> {
  const { columnPattern, schema, dataType } = args as {
    columnPattern: string;
    schema?: string;
    dataType?: string;
  };
  const dataTypeCond = dataType
    ? `AND DATA_TYPE = UPPER('${esc(dataType)}')`
    : "";
  const sql = `
    SELECT OWNER, TABLE_NAME, COLUMN_NAME, DATA_TYPE,
           DATA_LENGTH, DATA_PRECISION, DATA_SCALE, NULLABLE, COLUMN_ID
    FROM   ALL_TAB_COLUMNS
    WHERE  COLUMN_NAME LIKE UPPER('${esc(columnPattern)}')
    ${schemaFilter(schema)}
    ${dataTypeCond}
    ORDER  BY OWNER, TABLE_NAME, COLUMN_ID
  `;
  const rows = await connectionManager.execute<Row>(sql);
  return `Found ${rows.length} column(s).\n${formatRows(rows)}`;
}

async function handleDatabaseInfo(): Promise<string> {
  const versionSql = `
    SELECT BANNER, BANNER_FULL FROM V$VERSION WHERE ROWNUM = 1
  `;
  const nlsSql = `
    SELECT PARAMETER, VALUE FROM NLS_DATABASE_PARAMETERS
    WHERE  PARAMETER IN ('NLS_CHARACTERSET','NLS_LANGUAGE',
                         'NLS_TERRITORY','NLS_DATE_FORMAT')
  `;
  const instanceSql = `
    SELECT INSTANCE_NAME, HOST_NAME, VERSION, STARTUP_TIME,
           STATUS, DATABASE_STATUS
    FROM   V$INSTANCE
  `;
  try {
    const [version, nls, instance] = await Promise.all([
      connectionManager.execute<Row>(versionSql),
      connectionManager.execute<Row>(nlsSql),
      connectionManager.execute<Row>(instanceSql),
    ]);
    return JSON.stringify({ version: version[0], instance: instance[0], nls }, null, 2);
  } catch {
    // Fallback without V$ views
    const rows = await connectionManager.execute<Row>(
      `SELECT * FROM NLS_DATABASE_PARAMETERS WHERE ROWNUM <= 20`
    );
    return `Database NLS info (limited - no V$ access):\n${formatRows(rows)}`;
  }
}

async function handleCurrentSession(): Promise<string> {
  const sql = `
    SELECT SYS_CONTEXT('USERENV','SESSION_USER')     AS SESSION_USER,
           SYS_CONTEXT('USERENV','CURRENT_SCHEMA')   AS CURRENT_SCHEMA,
           SYS_CONTEXT('USERENV','DB_NAME')           AS DB_NAME,
           SYS_CONTEXT('USERENV','SERVER_HOST')       AS SERVER_HOST,
           SYS_CONTEXT('USERENV','OS_USER')           AS OS_USER,
           SYS_CONTEXT('USERENV','MODULE')            AS MODULE,
           SYS_CONTEXT('USERENV','NLS_DATE_FORMAT')   AS NLS_DATE_FORMAT,
           SYS_CONTEXT('USERENV','INSTANCE_NAME')     AS INSTANCE_NAME
    FROM   DUAL
  `;
  const rows = await connectionManager.execute<Row>(sql);
  return JSON.stringify(rows[0] ?? {}, null, 2);
}
