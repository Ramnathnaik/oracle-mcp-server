# Oracle MCP Server

A **read-only** Model Context Protocol (MCP) server for Oracle databases. Exposes rich schema introspection and data query tools to any MCP-compatible client (Claude Desktop, VS Code extensions, etc.).

---

## Features

| Category | Tools |
|---|---|
| **Connection** | `oracle_connect`, `oracle_connection_status` |
| **Tables & Views** | `oracle_list_tables`, `oracle_describe_table`, `oracle_list_views`, `oracle_get_view_definition` |
| **Data Query** | `oracle_query_table`, `oracle_execute_query`, `oracle_get_table_row_count` |
| **Constraints & Indexes** | `oracle_list_constraints`, `oracle_list_indexes` |
| **Procedures & Functions** | `oracle_list_procedures`, `oracle_get_procedure_source` |
| **Packages** | `oracle_list_packages`, `oracle_get_package_source` |
| **Triggers** | `oracle_list_triggers`, `oracle_get_trigger_source` |
| **Sequences** | `oracle_list_sequences`, `oracle_describe_sequence` |
| **Synonyms** | `oracle_list_synonyms` |
| **Database Links** | `oracle_list_db_links` |
| **Tablespaces** | `oracle_list_tablespaces` |
| **Schema Overview** | `oracle_list_schemas`, `oracle_schema_summary`, `oracle_list_object_types` |
| **Column Search** | `oracle_search_columns` |
| **DB / Session Info** | `oracle_database_info`, `oracle_current_session` |

> **Security**: All write/DDL operations (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `CREATE`, `ALTER`, `MERGE`, `TRUNCATE`, `GRANT`, `REVOKE`, `EXEC`) are blocked. Only `SELECT` and CTE (`WITH`) statements can be executed.

---

## Prerequisites

- **Node.js ≥ 18**
- Access to an Oracle Database (12c or later recommended)
- Oracle Instant Client (optional — the server uses Oracle's thin driver by default, which requires no additional binaries)

---

## Installation

```bash
# 1. Clone / copy the project
cd oracle-mcp-server

# 2. Install dependencies
npm install

# 3. Build TypeScript
npm run build
```

---

## Usage

### Option A — Manual connection (recommended)

Start the server and let the AI call `oracle_connect` when needed:

```bash
node dist/index.js
```

The first tool call should be `oracle_connect`:

```json
{
  "tool": "oracle_connect",
  "arguments": {
    "connectionString": "myhost:1521/ORCL",
    "username": "scott",
    "password": "tiger"
  }
}
```

### Option B — Auto-connect via environment variables

```bash
export ORACLE_CONNECTION_STRING="myhost:1521/ORCL"
export ORACLE_USERNAME="scott"
export ORACLE_PASSWORD="tiger"
node dist/index.js
```

The server connects automatically on startup.

---

## Connection String Formats

| Format | Example |
|---|---|
| Easy Connect | `host:port/service_name` |
| Easy Connect (full) | `//host:port/service_name` |
| TNS alias | `MYDB` (requires `tnsnames.ora`) |
| Full descriptor | `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=host)(PORT=1521))(CONNECT_DATA=(SERVICE_NAME=orcl)))` |

---

## Claude Desktop Configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "oracle": {
      "command": "node",
      "args": ["/absolute/path/to/oracle-mcp-server/dist/index.js"],
      "env": {
        "ORACLE_CONNECTION_STRING": "host:1521/service",
        "ORACLE_USERNAME": "myuser",
        "ORACLE_PASSWORD": "mypassword"
      }
    }
  }
}
```

---

## Tool Reference

### `oracle_connect`
Connect to an Oracle database. **Must be called first** unless environment variables are set.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `connectionString` | string | ✅ | Oracle connection string |
| `username` | string | ✅ | Database username |
| `password` | string | ✅ | Database password |

---

### `oracle_list_tables`
List tables with optional schema and name filters.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `schema` | string | current user | Owner/schema name |
| `pattern` | string | — | LIKE pattern (e.g. `EMP%`) |
| `includeSystemTables` | boolean | `false` | Include Oracle internal tables |

---

### `oracle_describe_table`
Get column definitions, types, nullability, comments, and table metadata.

---

### `oracle_query_table`
Paginated SELECT from a table or view.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `tableName` | string | ✅ | Table or view name |
| `columns` | string[] | all | Specific columns to return |
| `whereClause` | string | — | Filter condition (no `WHERE` keyword) |
| `orderBy` | string | — | Sort expression |
| `limit` | number | 100 | Max rows (hard cap: 1000) |
| `offset` | number | 0 | Row offset for pagination |

---

### `oracle_execute_query`
Execute any read-only SELECT or WITH query.

- DML/DDL is **blocked** at the application layer
- Results are capped at 1000 rows

---

### `oracle_get_package_source`
Retrieve PL/SQL package spec, body, or both.

| Parameter | Type | Default |
|---|---|---|
| `packageName` | string | ✅ |
| `part` | `SPEC` \| `BODY` \| `ALL` | `ALL` |

---

### `oracle_list_synonyms`
List private and/or public synonyms.

| Parameter | Type | Default |
|---|---|---|
| `synonymType` | `PRIVATE` \| `PUBLIC` \| `ALL` | `ALL` |

---

## Security Considerations

- Store credentials in environment variables, not in config files committed to version control.
- Use a **dedicated read-only Oracle user** with minimal privileges (e.g., `GRANT SELECT ANY TABLE TO readonly_user`).
- The server performs client-side SQL validation to block writes, but a dedicated read-only user adds defense-in-depth.
- Passwords are never logged or echoed back in tool responses.

---

## Development

```bash
# Run in development mode (no build step)
npm run dev

# Rebuild after changes
npm run build && node dist/index.js
```

---

## License

MIT
