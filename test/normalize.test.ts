import test from "node:test";
import assert from "node:assert/strict";

import type { MailMessage } from "../src/mail/types.js";
import {
  buildMailboxPath,
  compareIsoDatesDescending,
  isInboxMailboxName,
  mapWithConcurrency,
  normalizeIsoDateValue,
  sortMessagesNewestFirst,
} from "../src/mail/normalize.js";

function makeMessage(id: number, dateReceived: string | null): MailMessage {
  return {
    id,
    accountId: "account-1",
    accountName: "Mail",
    mailboxName: "INBOX",
    mailboxPath: "INBOX",
    mailboxPathSegments: ["INBOX"],
    subject: `Message ${id}`,
    sender: "sender@example.com",
    dateReceived,
    dateSent: dateReceived,
    read: false,
    flagged: false,
    deleted: false,
    toRecipients: [],
    ccRecipients: [],
    bccRecipients: [],
    content: "body",
    headers: [],
    attachments: [],
  };
}

test("buildMailboxPath joins path segments for display", () => {
  assert.equal(buildMailboxPath(["Archive", "2026", "Receipts"]), "Archive / 2026 / Receipts");
});

test("isInboxMailboxName matches common Mail inbox naming", () => {
  assert.equal(isInboxMailboxName("INBOX"), true);
  assert.equal(isInboxMailboxName("Inbox"), true);
  assert.equal(isInboxMailboxName("Archive"), false);
});

test("normalizeIsoDateValue converts strings and dates to ISO strings", () => {
  assert.equal(normalizeIsoDateValue("2026-04-01T13:30:59.000Z"), "2026-04-01T13:30:59.000Z");
  assert.equal(
    normalizeIsoDateValue(new Date("2026-04-01T13:30:59.000Z")),
    "2026-04-01T13:30:59.000Z",
  );
  assert.equal(normalizeIsoDateValue("not-a-date"), null);
});

test("compareIsoDatesDescending sorts newest dates first", () => {
  assert.equal(
    compareIsoDatesDescending("2026-04-02T00:00:00.000Z", "2026-04-01T00:00:00.000Z"),
    -1,
  );
  assert.equal(
    compareIsoDatesDescending("2026-04-01T00:00:00.000Z", "2026-04-02T00:00:00.000Z"),
    1,
  );
  assert.equal(compareIsoDatesDescending(null, null), 0);
});

test("sortMessagesNewestFirst keeps null dates at the end", () => {
  const sorted = sortMessagesNewestFirst([
    makeMessage(1, "2026-04-01T10:00:00.000Z"),
    makeMessage(2, null),
    makeMessage(3, "2026-04-02T10:00:00.000Z"),
  ]);

  assert.deepEqual(
    sorted.map((message) => message.id),
    [3, 1, 2],
  );
});

test("mapWithConcurrency preserves input order while limiting concurrency", async () => {
  const activeCounts: number[] = [];
  let active = 0;

  const results = await mapWithConcurrency([3, 1, 2], 2, async (value) => {
    active += 1;
    activeCounts.push(active);
    await new Promise((resolve) => setTimeout(resolve, value * 10));
    active -= 1;
    return value * 2;
  });

  assert.deepEqual(results, [6, 2, 4]);
  assert.equal(Math.max(...activeCounts), 2);
});
