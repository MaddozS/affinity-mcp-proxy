# affinity-mcp-proxy

`affinity-mcp-proxy` exposes the local Affinity MCP server as an MCP server over `stdio`.

It is designed for tools that know how to launch MCP servers as local commands, for example:

```json
{
  "mcpServers": {
    "affinity": {
      "command": "pnpm",
      "args": ["dlx", "affinity-mcp-proxy"]
    }
  }
}
```

## What it does

- connects to the local Affinity MCP server over HTTP/SSE
- re-exposes `tools/list` and `tools/call` over `stdio`
- primes `execute_script` with `read_preamble` in the same upstream session
- ships a small CLI for diagnostics and direct tool calls

## Status

- first-class target: macOS
- runtime: Node.js 22+
- package manager: `pnpm`

Other platforms may work, but this package is only validated on macOS in the first release.

## Install and run

Preferred ephemeral usage:

```bash
pnpm dlx affinity-mcp-proxy
```

Direct CLI usage:

```bash
pnpm dlx --package affinity-mcp-proxy affinity-mcp-proxy-cli list-tools
pnpm dlx --package affinity-mcp-proxy affinity-mcp-proxy-cli call-tool search_sdk_hints '{"query":"text style"}'
```

Local development:

```bash
pnpm install
pnpm test
pnpm dlx . --help
node ./affinity_mcp_proxy.mjs --help
```

## Requirements

- Affinity must be open
- the local Affinity MCP server must be enabled and listening
- Node.js 22 or newer

By default the proxy tries these upstream URLs:

- `http://127.0.0.1:6767/sse`
- `http://127.0.0.1:6767`
- `http://[::1]:6767/sse`
- `http://[::1]:6767`

## Environment variables

- `AFFINITY_MCP_URL`
  - force a specific upstream MCP URL
- `AFFINITY_MCP_CONNECT_TIMEOUT_MS`
  - override the connection timeout
- `AFFINITY_MCP_DEBUG`
  - enable proxy debug logs on `stderr`

The proxy requires the SDK to be installed through the package dependencies. There is no alternate local SDK fallback.

## Commands

Proxy server:

```bash
pnpm dlx affinity-mcp-proxy
pnpm dlx affinity-mcp-proxy --help
pnpm dlx affinity-mcp-proxy --version
```

Diagnostic CLI:

```bash
pnpm dlx --package affinity-mcp-proxy affinity-mcp-proxy-cli list-tools
pnpm dlx --package affinity-mcp-proxy affinity-mcp-proxy-cli execute-script-file ./script.js
pnpm dlx --package affinity-mcp-proxy affinity-mcp-proxy-cli render-spread-file DOCUMENT_SESSION_UUID '{"spread_index":2,"out":"/tmp/spread-2.jpg"}'
```

## Troubleshooting

If the proxy exits immediately:

- confirm Affinity is open
- confirm the local MCP endpoint is enabled
- set `AFFINITY_MCP_DEBUG=1` to see connection attempts
- if your environment prefers a specific interface, set `AFFINITY_MCP_URL` explicitly

If text formatting scripts fail inside Affinity with `COMMAND_FAILED`, make sure the script sets the current spread to the target text node spread before calling `doc.formatText(...)`.
