import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_AFFINITY_MCP_URLS,
  DEFAULT_CONNECT_TIMEOUT_MS,
  connectAffinityClient,
  getAffinityMcpUrls,
  getConnectTimeoutMs,
} from "../affinity_sdk.mjs";

test("getAffinityMcpUrls returns the configured override", () => {
  assert.deepEqual(getAffinityMcpUrls({ AFFINITY_MCP_URL: "http://example.test/sse" }), [
    "http://example.test/sse",
  ]);
});

test("getAffinityMcpUrls returns the default probe list", () => {
  assert.deepEqual(getAffinityMcpUrls({}), [...DEFAULT_AFFINITY_MCP_URLS]);
});

test("getConnectTimeoutMs parses valid values and falls back on invalid ones", () => {
  assert.equal(getConnectTimeoutMs({ AFFINITY_MCP_CONNECT_TIMEOUT_MS: "4500" }), 4500);
  assert.equal(getConnectTimeoutMs({ AFFINITY_MCP_CONNECT_TIMEOUT_MS: "nope" }), DEFAULT_CONNECT_TIMEOUT_MS);
  assert.equal(getConnectTimeoutMs({}), DEFAULT_CONNECT_TIMEOUT_MS);
});

test("connectAffinityClient reports a useful error when upstream is unavailable", async () => {
  await assert.rejects(
    connectAffinityClient(
      { name: "affinity-sdk-test", version: "0.0.0" },
      {
        AFFINITY_MCP_URL: "http://127.0.0.1:1/sse",
        AFFINITY_MCP_CONNECT_TIMEOUT_MS: "50",
      },
    ),
    (error) => {
      assert.match(error.message, /Unable to connect to the local Affinity MCP server/);
      assert.match(error.message, /Affinity is open/);
      assert.match(error.message, /127\.0\.0\.1:1\/sse/);
      return true;
    },
  );
});
