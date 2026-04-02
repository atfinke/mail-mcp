import test from "node:test";
import assert from "node:assert/strict";

import {
  assertAllowedMoveDestinationMailboxPath,
  isBlockedMoveDestinationMailboxPath,
} from "../src/mail/mailboxSafety.js";

test("isBlockedMoveDestinationMailboxPath detects trash and deleted paths", () => {
  assert.equal(isBlockedMoveDestinationMailboxPath(["Archive"]), false);
  assert.equal(isBlockedMoveDestinationMailboxPath(["Trash"]), true);
  assert.equal(isBlockedMoveDestinationMailboxPath(["Deleted Messages"]), true);
  assert.equal(isBlockedMoveDestinationMailboxPath(["Projects", "Deleted Items"]), true);
});

test("assertAllowedMoveDestinationMailboxPath throws for blocked destinations", () => {
  assert.throws(
    () => assertAllowedMoveDestinationMailboxPath(["Trash"]),
    /Trash or deleted mailboxes/u,
  );
});
