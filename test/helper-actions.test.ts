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
