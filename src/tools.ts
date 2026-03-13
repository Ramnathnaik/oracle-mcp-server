import { Tool } from "@modelcontextprotocol/sdk/types.js";

export const ORACLE_TOOLS: Tool[] = [
  // ─── Connection ───────────────────────────────────────────────
  {
    name: "oracle_connect",
    description:
      "Connect to an Oracle database using a connection string. Must be called before any other tool.",
    inputSchema: {
      type: "object",
      properties: {
        connectionString: {
          type: "string",
          description:
            "Oracle connection string. Formats: Easy Connect ('host:port/service'), TNS alias, or full descriptor.",
        },
        username: { type: "string", description: "Oracle database username" },
        password: { type: "string", description: "Oracle database password" },
      },
      required: ["connectionString", "username", "password"],
    },
  },
  {
    name: "oracle_connection_status",
    description: "Check the current Oracle database connection status.",
    inputSchema: { type: "object", properties: {} },
  },

  // ─── Tables & Views ───────────────────────────────────────────
  {
    name: "oracle_list_tables",
    description:
      "List all tables accessible to the current user, optionally filtered by schema or name pattern.",
    inputSchema: {
      type: "object",
      properties: {
        schema: {
          type: "string",
          description: "Owner/schema name (default: current user's schema)",
        },
        pattern: {
          type: "string",
          description: "LIKE pattern to filter table names (e.g. 'EMP%')",
        },
        includeSystemTables: {
          type: "boolean",
          description: "Include Oracle system/internal tables (default: false)",
        },
      },
    },
  },
  {
    name: "oracle_describe_table",
    description:
      "Get full column definitions, constraints, and indexes for a table.",
    inputSchema: {
      type: "object",
      properties: {
        tableName: { type: "string", description: "Table name" },
        schema: { type: "string", description: "Owner/schema (optional)" },
      },
      required: ["tableName"],
    },
  },
  {
    name: "oracle_list_views",
    description: "List database views, optionally filtered by schema or name.",
    inputSchema: {
      type: "object",
      properties: {
        schema: { type: "string" },
        pattern: { type: "string" },
      },
    },
  },
  {
    name: "oracle_get_view_definition",
    description: "Get the SQL definition of a specific view.",
    inputSchema: {
      type: "object",
      properties: {
        viewName: { type: "string", description: "View name" },
        schema: { type: "string" },
      },
      required: ["viewName"],
    },
  },

  // ─── Data Query ───────────────────────────────────────────────
  {
    name: "oracle_query_table",
    description:
      "SELECT data from a table or view with optional WHERE, ORDER BY, and row limit. Read-only.",
    inputSchema: {
      type: "object",
      properties: {
        tableName: { type: "string", description: "Table or view name" },
        schema: { type: "string" },
        columns: {
          type: "array",
          items: { type: "string" },
          description: "Columns to select (default: all)",
        },
        whereClause: {
          type: "string",
          description: "WHERE clause without the WHERE keyword",
        },
        orderBy: { type: "string", description: "ORDER BY clause" },
        limit: {
          type: "number",
          description: "Max rows to return (default: 100, max: 1000)",
        },
        offset: { type: "number", description: "Row offset for pagination" },
      },
      required: ["tableName"],
    },
  },
  {
    name: "oracle_execute_query",
    description:
      "Execute a custom read-only SELECT query. DML/DDL statements are blocked.",
    inputSchema: {
      type: "object",
      properties: {
        sql: {
          type: "string",
          description: "A SELECT statement to execute",
        },
        limit: {
          type: "number",
          description: "Max rows (default: 100, max: 1000)",
        },
      },
      required: ["sql"],
    },
  },
  {
    name: "oracle_get_table_row_count",
    description: "Get the row count for one or more tables.",
    inputSchema: {
      type: "object",
      properties: {
        tableNames: {
          type: "array",
          items: { type: "string" },
          description: "Table names to count",
        },
        schema: { type: "string" },
      },
      required: ["tableNames"],
    },
  },

  // ─── Constraints & Indexes ────────────────────────────────────
  {
    name: "oracle_list_constraints",
    description:
      "List primary keys, foreign keys, unique, and check constraints for a table.",
    inputSchema: {
      type: "object",
      properties: {
        tableName: { type: "string" },
        schema: { type: "string" },
        constraintType: {
          type: "string",
          enum: ["P", "R", "U", "C", "ALL"],
          description:
            "P=Primary, R=Foreign key, U=Unique, C=Check, ALL=all (default)",
        },
      },
      required: ["tableName"],
    },
  },
  {
    name: "oracle_list_indexes",
    description: "List indexes on a table including index type and columns.",
    inputSchema: {
      type: "object",
      properties: {
        tableName: { type: "string" },
        schema: { type: "string" },
      },
      required: ["tableName"],
    },
  },

  // ─── Stored Objects ───────────────────────────────────────────
  {
    name: "oracle_list_procedures",
    description:
      "List stored procedures and functions in a schema.",
    inputSchema: {
      type: "object",
      properties: {
        schema: { type: "string" },
        pattern: { type: "string" },
        objectType: {
          type: "string",
          enum: ["PROCEDURE", "FUNCTION", "ALL"],
          description: "Filter by type (default: ALL)",
        },
      },
    },
  },
  {
    name: "oracle_get_procedure_source",
    description: "Get the source code of a stored procedure or function.",
    inputSchema: {
      type: "object",
      properties: {
        objectName: { type: "string" },
        schema: { type: "string" },
        objectType: {
          type: "string",
          enum: ["PROCEDURE", "FUNCTION"],
          default: "PROCEDURE",
        },
      },
      required: ["objectName"],
    },
  },
  {
    name: "oracle_list_packages",
    description: "List PL/SQL packages in a schema.",
    inputSchema: {
      type: "object",
      properties: {
        schema: { type: "string" },
        pattern: { type: "string" },
      },
    },
  },
  {
    name: "oracle_get_package_source",
    description:
      "Get the source of a PL/SQL package spec and/or body.",
    inputSchema: {
      type: "object",
      properties: {
        packageName: { type: "string" },
        schema: { type: "string" },
        part: {
          type: "string",
          enum: ["SPEC", "BODY", "ALL"],
          description: "Which part to retrieve (default: ALL)",
        },
      },
      required: ["packageName"],
    },
  },
  {
    name: "oracle_list_triggers",
    description: "List database triggers, optionally filtered by table.",
    inputSchema: {
      type: "object",
      properties: {
        schema: { type: "string" },
        tableName: {
          type: "string",
          description: "Filter triggers by table name",
        },
        pattern: { type: "string" },
      },
    },
  },
  {
    name: "oracle_get_trigger_source",
    description: "Get the source code of a trigger.",
    inputSchema: {
      type: "object",
      properties: {
        triggerName: { type: "string" },
        schema: { type: "string" },
      },
      required: ["triggerName"],
    },
  },

  // ─── Sequences ────────────────────────────────────────────────
  {
    name: "oracle_list_sequences",
    description: "List sequences including current value, min, max, and increment.",
    inputSchema: {
      type: "object",
      properties: {
        schema: { type: "string" },
        pattern: { type: "string" },
      },
    },
  },
  {
    name: "oracle_describe_sequence",
    description: "Get full details of a specific sequence.",
    inputSchema: {
      type: "object",
      properties: {
        sequenceName: { type: "string" },
        schema: { type: "string" },
      },
      required: ["sequenceName"],
    },
  },

  // ─── Synonyms ─────────────────────────────────────────────────
  {
    name: "oracle_list_synonyms",
    description: "List synonyms (private and/or public) and their target objects.",
    inputSchema: {
      type: "object",
      properties: {
        schema: { type: "string" },
        pattern: { type: "string" },
        synonymType: {
          type: "string",
          enum: ["PRIVATE", "PUBLIC", "ALL"],
          description: "Filter by synonym type (default: ALL)",
        },
      },
    },
  },

  // ─── Database Links ───────────────────────────────────────────
  {
    name: "oracle_list_db_links",
    description: "List database links accessible to the user.",
    inputSchema: {
      type: "object",
      properties: {
        schema: { type: "string" },
      },
    },
  },

  // ─── Tablespaces & Storage ────────────────────────────────────
  {
    name: "oracle_list_tablespaces",
    description: "List tablespaces with size and usage information.",
    inputSchema: { type: "object", properties: {} },
  },

  // ─── Schema Overview ──────────────────────────────────────────
  {
    name: "oracle_list_schemas",
    description: "List all schemas/users in the database.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string" },
        includeSystem: {
          type: "boolean",
          description: "Include Oracle system schemas (default: false)",
        },
      },
    },
  },
  {
    name: "oracle_schema_summary",
    description:
      "Get an object-count summary for a schema: tables, views, procedures, sequences, etc.",
    inputSchema: {
      type: "object",
      properties: {
        schema: {
          type: "string",
          description: "Schema to summarise (default: current user)",
        },
      },
    },
  },
  {
    name: "oracle_list_object_types",
    description:
      "List all distinct object types present in a schema.",
    inputSchema: {
      type: "object",
      properties: {
        schema: { type: "string" },
      },
    },
  },

  // ─── Columns & Metadata ───────────────────────────────────────
  {
    name: "oracle_search_columns",
    description:
      "Search for columns by name across all tables in a schema.",
    inputSchema: {
      type: "object",
      properties: {
        columnPattern: {
          type: "string",
          description: "LIKE pattern for column name (e.g. '%_ID')",
        },
        schema: { type: "string" },
        dataType: {
          type: "string",
          description: "Filter by data type (e.g. 'VARCHAR2', 'NUMBER')",
        },
      },
      required: ["columnPattern"],
    },
  },

  // ─── Session & Database Info ──────────────────────────────────
  {
    name: "oracle_database_info",
    description:
      "Get general information about the Oracle database instance: version, NLS settings, etc.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "oracle_current_session",
    description: "Get details about the current database session and user.",
    inputSchema: { type: "object", properties: {} },
  },
];
