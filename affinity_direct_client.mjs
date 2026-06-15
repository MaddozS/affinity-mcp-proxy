#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";

import { PACKAGE_NAME, PACKAGE_VERSION } from "./affinity_package.mjs";
import { connectAffinityClient, maybeReadPreamble } from "./affinity_sdk.mjs";

function usage() {
  console.log(
    [
      `Usage: ${PACKAGE_NAME}-cli <command>`,
      "",
      "Commands:",
      "  list-tools",
      "  call-tool <toolName> <json | @path.json>",
      "  execute-script-file <scriptPath>",
      "  render-spread-file <documentSessionUuid> <json>",
    ].join("\n"),
  );
}

function parseJsonArg(raw, fallback = {}) {
  if (!raw) return fallback;
  if (raw.startsWith("@")) {
    return JSON.parse(readFileSync(raw.slice(1), "utf8"));
  }
  return JSON.parse(raw);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);

  if (!command || command === "--help" || command === "-h") {
    usage();
    return;
  }

  if (command === "--version" || command === "-v") {
    console.log(PACKAGE_VERSION);
    return;
  }

  const client = await connectAffinityClient(
    {
      name: `${PACKAGE_NAME}-cli`,
      version: PACKAGE_VERSION,
    },
    process.env,
  );

  try {
    if (command === "list-tools") {
      const result = await client.listTools();
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (command === "call-tool") {
      const [toolName, payloadRaw] = rest;
      if (!toolName) {
        usage();
        process.exitCode = 1;
        return;
      }

      const payload = parseJsonArg(payloadRaw, {});
      const result = await client.callTool({ name: toolName, arguments: payload });
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (command === "execute-script-file") {
      const [scriptPath] = rest;
      if (!scriptPath) {
        usage();
        process.exitCode = 1;
        return;
      }

      await maybeReadPreamble(client);
      const script = readFileSync(scriptPath, "utf8");
      const result = await client.callTool({
        name: "execute_script",
        arguments: { script },
      });
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (command === "render-spread-file") {
      const [documentSessionUuid, payloadRaw] = rest;
      if (!documentSessionUuid || !payloadRaw) {
        usage();
        process.exitCode = 1;
        return;
      }

      const payload = parseJsonArg(payloadRaw);
      const result = await client.callTool({
        name: "render_spread",
        arguments: {
          document_session_uuid: documentSessionUuid,
          spread_index: payload.spread_index,
        },
      });
      const image = result?.content?.find((item) => item.type === "image");
      if (!image?.data || !payload.out) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      writeFileSync(payload.out, Buffer.from(image.data, "base64"));
      console.log(
        JSON.stringify(
          {
            ok: true,
            out: payload.out,
            mimeType: image.mimeType || "image/jpeg",
          },
          null,
          2,
        ),
      );
      return;
    }

    usage();
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error?.message || String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
