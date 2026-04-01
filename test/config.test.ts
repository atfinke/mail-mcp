import test from "node:test";
import assert from "node:assert/strict";

import { loadConfig } from "../src/config.js";

test("loadConfig returns default values when env vars are unset", () => {
  const config = loadConfig({});

  assert.deepEqual(config, {
    inboxConcurrency: 2,
    requestTimeoutMs: 30_000,
  });
});

test("loadConfig parses explicit environment overrides", () => {
  const config = loadConfig({
    MAIL_MCP_INBOX_CONCURRENCY: "4",
    MAIL_MCP_REQUEST_TIMEOUT_MS: "45000",
  });

  assert.deepEqual(config, {
    inboxConcurrency: 4,
    requestTimeoutMs: 45_000,
  });
});

test("loadConfig rejects invalid environment values", () => {
  assert.throws(
    () =>
      loadConfig({
        MAIL_MCP_INBOX_CONCURRENCY: "0",
      }),
    /Invalid Mail MCP configuration/u,
  );
});
