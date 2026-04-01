import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadConfig } from "../src/config.js";

test("loadConfig returns default values when env vars are unset", () => {
  const config = loadConfig({});

  assert.deepEqual(config, {
    requestTimeoutMs: 30_000,
    helperTimeoutMs: 30_000,
    helperAppPath: path.resolve(
      process.cwd(),
      "MailMCPHelperApp/build/Build/Products/Release/MailMCPHelperApp.app",
    ),
  });
});

test("loadConfig parses explicit environment overrides", () => {
  const config = loadConfig({
    MAIL_MCP_REQUEST_TIMEOUT_MS: "45000",
    MAIL_MCP_HELPER_TIMEOUT_MS: "60000",
    MAIL_MCP_HELPER_APP_PATH: "/tmp/MailMCPHelperApp.app",
  });

  assert.deepEqual(config, {
    requestTimeoutMs: 45_000,
    helperTimeoutMs: 60_000,
    helperAppPath: "/tmp/MailMCPHelperApp.app",
  });
});

test("loadConfig rejects invalid environment values", () => {
  assert.throws(
    () =>
      loadConfig({
        MAIL_MCP_REQUEST_TIMEOUT_MS: "0",
      }),
    /Invalid Mail MCP configuration/u,
  );
});
