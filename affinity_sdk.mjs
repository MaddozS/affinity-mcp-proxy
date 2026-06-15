import { PACKAGE_NAME, PACKAGE_VERSION } from "./affinity_package.mjs";

export const DEFAULT_AFFINITY_MCP_URLS = Object.freeze([
  "http://127.0.0.1:6767/sse",
  "http://127.0.0.1:6767",
  "http://[::1]:6767/sse",
  "http://[::1]:6767",
]);

export const DEFAULT_CONNECT_TIMEOUT_MS = 3000;

async function importSdkGroup(packageImports) {
  try {
    return await Promise.all(packageImports.map((specifier) => import(specifier)));
  } catch {
    throw new Error(
      [
        "MCP SDK not found.",
        "Install dependencies with `pnpm install` before running the proxy.",
      ].join(" "),
    );
  }
}

function parseBoolean(value) {
  return /^(1|true|yes|on)$/i.test(value || "");
}

function parsePositiveInt(value, fallback) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getAffinityMcpUrls(env = process.env) {
  if (env.AFFINITY_MCP_URL) {
    return [env.AFFINITY_MCP_URL];
  }

  return [...DEFAULT_AFFINITY_MCP_URLS];
}

export function getConnectTimeoutMs(env = process.env) {
  return parsePositiveInt(env.AFFINITY_MCP_CONNECT_TIMEOUT_MS, DEFAULT_CONNECT_TIMEOUT_MS);
}

export function createDebugLogger(env = process.env, scope = PACKAGE_NAME) {
  if (!parseBoolean(env.AFFINITY_MCP_DEBUG)) {
    return () => {};
  }

  return (message, details) => {
    const suffix = details ? ` ${details}` : "";
    console.error(`[${scope}] ${message}${suffix}`);
  };
}

export async function loadClientSdk() {
  const [clientMod, sseMod] = await importSdkGroup(
    [
      "@modelcontextprotocol/sdk/client/index.js",
      "@modelcontextprotocol/sdk/client/sse.js",
    ],
  );

  return {
    Client: clientMod.Client,
    SSEClientTransport: sseMod.SSEClientTransport,
  };
}

export async function loadStdioClientSdk() {
  const [clientMod, stdioMod] = await importSdkGroup(
    [
      "@modelcontextprotocol/sdk/client/index.js",
      "@modelcontextprotocol/sdk/client/stdio.js",
    ],
  );

  return {
    Client: clientMod.Client,
    StdioClientTransport: stdioMod.StdioClientTransport,
  };
}

export async function loadProxySdk() {
  const [serverMod, stdioMod, typesMod] = await importSdkGroup(
    [
      "@modelcontextprotocol/sdk/server/index.js",
      "@modelcontextprotocol/sdk/server/stdio.js",
      "@modelcontextprotocol/sdk/types.js",
    ],
  );

  return {
    Server: serverMod.Server,
    StdioServerTransport: stdioMod.StdioServerTransport,
    ListToolsRequestSchema: typesMod.ListToolsRequestSchema,
    CallToolRequestSchema: typesMod.CallToolRequestSchema,
  };
}

export async function loadSseServerSdk() {
  const [serverMod, sseMod, typesMod] = await importSdkGroup(
    [
      "@modelcontextprotocol/sdk/server/index.js",
      "@modelcontextprotocol/sdk/server/sse.js",
      "@modelcontextprotocol/sdk/types.js",
    ],
  );

  return {
    Server: serverMod.Server,
    SSEServerTransport: sseMod.SSEServerTransport,
    ListToolsRequestSchema: typesMod.ListToolsRequestSchema,
    CallToolRequestSchema: typesMod.CallToolRequestSchema,
  };
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

async function withTimeout(promise, timeoutMs, message) {
  let timer = null;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(message));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export async function connectAffinityClient(serverInfo = {}, env = process.env) {
  const { Client, SSEClientTransport } = await loadClientSdk();
  const timeoutMs = getConnectTimeoutMs(env);
  const candidates = getAffinityMcpUrls(env);
  const debug = createDebugLogger(env, serverInfo.name || PACKAGE_NAME);

  let lastError = null;

  for (const candidate of candidates) {
    const client = new Client(
      {
        name: serverInfo.name || PACKAGE_NAME,
        version: serverInfo.version || PACKAGE_VERSION,
      },
      { capabilities: {} },
    );

    try {
      debug("Trying upstream", candidate);
      const transport = new SSEClientTransport(new URL(candidate));
      await withTimeout(
        client.connect(transport),
        timeoutMs,
        `Timed out after ${timeoutMs}ms while connecting to ${candidate}`,
      );
      debug("Connected upstream", candidate);
      return client;
    } catch (error) {
      lastError = error;
      debug("Upstream connection failed", `${candidate}: ${formatError(error)}`);
      await Promise.allSettled([client.close()]);
    }
  }

  throw new Error(
    [
      "Unable to connect to the local Affinity MCP server.",
      "Make sure Affinity is open and its MCP endpoint is available.",
      `Tried: ${candidates.join(", ")}.`,
      lastError ? `Last error: ${formatError(lastError)}` : "",
    ]
      .filter(Boolean)
      .join(" "),
  );
}

export async function maybeReadPreamble(client) {
  try {
    await client.callTool({ name: "read_preamble", arguments: {} });
  } catch {
    return;
  }
}
