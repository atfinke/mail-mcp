import test from "node:test";
import assert from "node:assert/strict";

import type { ZodType } from "zod";

import type { MailClient } from "../src/mail/client.js";
import { createServer } from "../src/server.js";

function getInputSchema(toolName: string): ZodType {
  const server = createServer({} as MailClient) as unknown as {
    _registeredTools: Record<string, { inputSchema: ZodType }>;
  };
  const tool = server._registeredTools[toolName];

  assert.ok(tool, `Expected tool ${toolName} to be registered.`);
  return tool.inputSchema;
}

test("mail_get_message requires mailboxPathSegments and messageId", () => {
  const schema = getInputSchema("mail_get_message");
  const parsed = schema.parse({
    accountId: "account-1",
    mailboxPathSegments: ["Inbox"],
    messageId: 42,
  });

  assert.deepEqual(parsed, {
    accountId: "account-1",
    mailboxPathSegments: ["Inbox"],
    messageId: 42,
  });
  assert.equal(
    schema.safeParse({
      accountId: "account-1",
      mailboxPath: ["Inbox"],
      messageId: 42,
    }).success,
    false,
  );
  assert.equal(
    schema.safeParse({
      accountId: "account-1",
      mailboxPathSegments: ["Inbox"],
      id: 42,
    }).success,
    false,
  );
});

test("mail_reply_to_message requires mailboxPathSegments", () => {
  const schema = getInputSchema("mail_reply_to_message");

  assert.equal(
    schema.safeParse({
      accountId: "account-1",
      mailboxPathSegments: ["Inbox"],
      messageId: 7,
    }).success,
    true,
  );
  assert.equal(
    schema.safeParse({
      accountId: "account-1",
      mailboxPath: ["Inbox"],
      messageId: 7,
    }).success,
    false,
  );
});

test("mail_move_message requires explicit source and destination segment arrays", () => {
  const schema = getInputSchema("mail_move_message");

  assert.equal(
    schema.safeParse({
      accountId: "account-1",
      mailboxPathSegments: ["Inbox"],
      destinationMailboxPathSegments: ["Archive", "2026"],
      messageId: 7,
    }).success,
    true,
  );
  assert.equal(
    schema.safeParse({
      accountId: "account-1",
      mailboxPathSegments: ["Inbox"],
      destinationMailboxPath: ["Archive", "2026"],
      messageId: 7,
    }).success,
    false,
  );
});
