#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { PACKAGE_NAME, PACKAGE_VERSION } from "./affinity_package.mjs";
import { connectAffinityClient, createDebugLogger, loadProxySdk, maybeReadPreamble } from "./affinity_sdk.mjs";

function usage() {
  console.log(
    [
      `Usage: ${PACKAGE_NAME} [--help] [--version]`,
      "",
      "Environment:",
      "  AFFINITY_MCP_URL",
      "  AFFINITY_MCP_CONNECT_TIMEOUT_MS",
      "  AFFINITY_MCP_DEBUG",
    ].join("\n"),
  );
}

function createToolError(error) {
  return {
    content: [
      {
        type: "text",
        text: error instanceof Error ? error.message : String(error),
      },
    ],
    isError: true,
  };
}

export function registerProxyHandlers(server, upstream, schemas, debug = () => {}) {
  const { ListToolsRequestSchema, CallToolRequestSchema } = schemas;

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    debug("Forwarding tools/list");
    const result = await upstream.listTools();
    return { tools: result.tools || [] };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      debug("Forwarding tools/call", request.params.name);

      if (request.params.name === "execute_script") {
        await maybeReadPreamble(upstream);
      }

      return await upstream.callTool({
        name: request.params.name,
        arguments: request.params.arguments || {},
      });
    } catch (error) {
      return createToolError(error);
    }
  });
}

async function main() {
  const [command] = process.argv.slice(2);

  if (command === "--help" || command === "-h") {
    usage();
    return;
  }

  if (command === "--version" || command === "-v") {
    console.log(PACKAGE_VERSION);
    return;
  }

  const debug = createDebugLogger(process.env, PACKAGE_NAME);
  const upstream = await connectAffinityClient(
    {
      name: `${PACKAGE_NAME}-upstream`,
      version: PACKAGE_VERSION,
    },
    process.env,
  );
  const { Server, StdioServerTransport, ListToolsRequestSchema, CallToolRequestSchema } =
    await loadProxySdk();

  const server = new Server(
    { name: PACKAGE_NAME, version: PACKAGE_VERSION },
    { capabilities: { tools: { listChanged: true } } },
  );
  registerProxyHandlers(
    server,
    upstream,
    { ListToolsRequestSchema, CallToolRequestSchema },
    debug,
  );

  const transport = new StdioServerTransport();

  let closed = false;
  async function cleanup(exitCode = 0) {
    if (closed) return;
    closed = true;
    await Promise.allSettled([server.close(), upstream.close()]);
    process.exit(exitCode);
  }

  process.on("SIGINT", () => {
    void cleanup(0);
  });
  process.on("SIGTERM", () => {
    void cleanup(0);
  });

  debug("Proxy ready");
  await server.connect(transport);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      ),
    );
    process.exit(1);
  });
}
