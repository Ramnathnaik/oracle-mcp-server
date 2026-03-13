#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";

import { ORACLE_TOOLS } from "./tools.js";
import { handleTool } from "./handlers.js";
import { connectionManager } from "./connection.js";

// ── Server bootstrap ──────────────────────────────────────────────────────────

const server = new Server(
  {
    name: "oracle-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ── Tool listing ──────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: ORACLE_TOOLS,
}));

// ── Tool execution ────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    const result = await handleTool(name, args as Record<string, unknown>);
    return {
      content: [{ type: "text", text: result }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Provide friendly guidance for connection errors
    if (message.includes("not initialized") || message.includes("NJS-003")) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Database not connected. Please use the oracle_connect tool first.\n\nError: ${message}`
      );
    }

    // Surface Oracle ORA- errors clearly
    if (message.includes("ORA-")) {
      throw new McpError(
        ErrorCode.InternalError,
        `Oracle error: ${message}`
      );
    }

    throw new McpError(ErrorCode.InternalError, message);
  }
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────

async function shutdown(): Promise<void> {
  console.error("Shutting down Oracle MCP server…");
  await connectionManager.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// ── Optional: auto-connect via environment variables ──────────────────────────
// Set ORACLE_CONNECTION_STRING, ORACLE_USERNAME, ORACLE_PASSWORD to connect
// automatically on startup without calling oracle_connect.

async function maybeAutoConnect(): Promise<void> {
  const connectionString = process.env.ORACLE_CONNECTION_STRING;
  const username = process.env.ORACLE_USERNAME;
  const password = process.env.ORACLE_PASSWORD;

  if (connectionString && username && password) {
    console.error("Auto-connecting to Oracle via environment variables…");
    try {
      await connectionManager.initialize({ connectionString, username, password });
      console.error("Auto-connection successful.");
    } catch (err) {
      console.error(
        "Auto-connection failed (you can still connect manually via oracle_connect):",
        err
      );
    }
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await maybeAutoConnect();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Oracle MCP Server running on stdio.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
