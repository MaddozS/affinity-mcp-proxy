import test from "node:test";
import assert from "node:assert/strict";

import { registerProxyHandlers } from "../affinity_mcp_proxy.mjs";

test("proxy handlers mirror tools/list and prime execute_script", async () => {
  const calls = [];
  const listSchema = Symbol("tools/list");
  const callSchema = Symbol("tools/call");
  const handlers = new Map();
  const upstream = {
    async listTools() {
      return {
        tools: [
          { name: "read_preamble" },
          { name: "execute_script" },
          { name: "echo" },
        ],
      };
    },
    async callTool(request) {
      calls.push({
        name: request.name,
        arguments: request.arguments || {},
      });

      if (request.name === "echo") {
        return {
          content: [{ type: "text", text: request.arguments?.message || "" }],
          structuredContent: { echoed: request.arguments?.message || "" },
        };
      }

      return {
        content: [{ type: "text", text: request.name }],
      };
    },
  };

  registerProxyHandlers(
    {
      setRequestHandler(schema, handler) {
        handlers.set(schema, handler);
      },
    },
    upstream,
    {
      ListToolsRequestSchema: listSchema,
      CallToolRequestSchema: callSchema,
    },
  );

  const listResult = await handlers.get(listSchema)();
  assert.deepEqual(
    listResult.tools.map((tool) => tool.name),
    ["read_preamble", "execute_script", "echo"],
  );

  const echoResult = await handlers.get(callSchema)({
    params: {
      name: "echo",
      arguments: { message: "hello" },
    },
  });
  assert.deepEqual(echoResult.structuredContent, { echoed: "hello" });

  await handlers.get(callSchema)({
    params: {
      name: "execute_script",
      arguments: { script: "42;" },
    },
  });

  assert.deepEqual(
    calls.map((call) => call.name),
    ["echo", "read_preamble", "execute_script"],
  );
});
