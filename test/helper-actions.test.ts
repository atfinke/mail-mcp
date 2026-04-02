import test from "node:test";
import assert from "node:assert/strict";

import { MailHelperRequestSchema } from "../src/mail/helperActions.js";

test("MailHelperRequestSchema accepts mailbox listing requests", () => {
  const request = MailHelperRequestSchema.parse({
    action: "listMessagesForMailbox",
    accountId: "account-1",
    mailboxPathSegments: ["Inbox"],
    unreadOnly: true,
    includeHeaders: false,
  });

  assert.equal(request.action, "listMessagesForMailbox");
  assert.deepEqual(request.mailboxPathSegments, ["Inbox"]);
});

test("MailHelperRequestSchema rejects empty mailbox paths", () => {
  assert.throws(
    () =>
      MailHelperRequestSchema.parse({
        action: "getMessage",
        accountId: "account-1",
        mailboxPathSegments: [],
        messageId: 1,
      }),
    />=1 items/u,
  );
});

test("MailHelperRequestSchema accepts constrained move requests", () => {
  const request = MailHelperRequestSchema.parse({
    action: "moveMessage",
    accountId: "account-1",
    mailboxPathSegments: ["Inbox"],
    destinationMailboxPathSegments: ["Archive", "2026"],
    messageId: 1,
  });

  assert.equal(request.action, "moveMessage");
  assert.deepEqual(request.destinationMailboxPathSegments, ["Archive", "2026"]);
});

test("MailHelperRequestSchema rejects trash move destinations", () => {
  assert.throws(
    () =>
      MailHelperRequestSchema.parse({
        action: "moveMessage",
        accountId: "account-1",
        mailboxPathSegments: ["Inbox"],
        destinationMailboxPathSegments: ["Trash"],
        messageId: 1,
      }),
    /Trash or deleted mailboxes/u,
  );
});
