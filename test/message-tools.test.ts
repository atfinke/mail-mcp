import test from "node:test";
import assert from "node:assert/strict";

import { MailMessageSchema } from "../src/mail/types.js";
import { applyHeadersOnlyMode } from "../src/tools/messageTools.js";

function makeMessage(overrides: Partial<ReturnType<typeof MailMessageSchema.parse>> = {}) {
  return MailMessageSchema.parse({
    id: 1,
    accountId: "account-1",
    accountName: "Account 1",
    mailboxName: "Inbox",
    mailboxPath: "Inbox",
    mailboxPathSegments: ["Inbox"],
    subject: "Subject",
    sender: "sender@example.com",
    dateReceived: "2026-04-01T08:30:00Z",
    dateSent: "2026-04-01T08:25:00Z",
    read: false,
    flagged: false,
    deleted: false,
    toRecipients: [],
    ccRecipients: [],
    bccRecipients: [],
    content: "Full message body",
    headers: [],
    attachments: [],
    ...overrides,
  });
}

test("applyHeadersOnlyMode replaces message content when enabled", () => {
  const items = [
    makeMessage(),
    makeMessage({ id: 2, subject: "Another", content: "Another body" }),
  ];

  const result = applyHeadersOnlyMode(items, true);

  assert.notStrictEqual(result, items);
  assert.deepEqual(
    result.map((item) => item.content),
    ["", ""],
  );
  assert.equal(result[0]?.subject, "Subject");
  assert.equal(result[1]?.subject, "Another");
  assert.equal(items[0]?.content, "Full message body");
  assert.equal(items[1]?.content, "Another body");
});

test("applyHeadersOnlyMode leaves messages unchanged when disabled", () => {
  const items = [makeMessage()];

  const result = applyHeadersOnlyMode(items, false);

  assert.strictEqual(result, items);
  assert.equal(result[0]?.content, "Full message body");
});
