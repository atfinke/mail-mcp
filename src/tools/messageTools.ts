import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { MailClient } from "../mail/client.js";
import { isBlockedMoveDestinationMailboxPath } from "../mail/mailboxSafety.js";
import type { MailMessage } from "../mail/types.js";
import { MailMessageResultSchema, MailMessagesResultSchema, MailMoveResultSchema } from "../mail/types.js";
import {
  WRITE_TOOL_ANNOTATIONS,
  optionalDateParam,
  positiveIntParam,
  registerReadTool,
  registerWriteTool,
} from "./common.js";

const mailboxPathParam = z.array(z.string()).min(1, "Provide at least one mailbox path segment.");
const moveDestinationMailboxPathParam = mailboxPathParam.refine(
  (pathSegments) => !isBlockedMoveDestinationMailboxPath(pathSegments),
  "Moving messages to Trash or deleted mailboxes is not allowed.",
);
const MOVE_TOOL_ANNOTATIONS = {
  ...WRITE_TOOL_ANNOTATIONS,
  destructiveHint: true,
};

export function applyHeadersOnlyMode(items: MailMessage[], headersOnly = false): MailMessage[] {
  if (!headersOnly) {
    return items;
  }

  return items.map((item) => ({
    ...item,
    content: "",
  }));
}

export function registerMessageTools(server: McpServer, client: MailClient): void {
  registerReadTool(
    server,
    "mail_list_mailbox_messages",
    "List Mailbox Messages",
    "Return messages for one specific Mail mailbox. Set headersOnly to true to omit message body content.",
    {
      accountId: z.string(),
      mailboxPath: mailboxPathParam,
      unreadOnly: z.boolean().optional(),
      since: optionalDateParam,
      limit: positiveIntParam.max(500).optional(),
      includeHeaders: z.boolean().optional(),
      headersOnly: z.boolean().optional(),
    },
    MailMessagesResultSchema,
    async ({ accountId, mailboxPath, unreadOnly, since, limit, includeHeaders, headersOnly }) => {
      const items = await client.listMailboxMessages({
        accountId,
        mailboxPath,
        unreadOnly: unreadOnly ?? false,
        since,
        limit,
        includeHeaders: includeHeaders ?? false,
      });

      return {
        count: items.length,
        items: applyHeadersOnlyMode(items, headersOnly ?? false),
      };
    },
  );

  registerReadTool(
    server,
    "mail_list_inbox_messages",
    "List Inbox Messages",
    "Return messages for every inbox mailbox, fetched in parallel with a small concurrency cap. Set headersOnly to true to omit message body content.",
    {
      accountIds: z.array(z.string()).optional(),
      unreadOnly: z.boolean().optional(),
      since: optionalDateParam,
      limitPerInbox: positiveIntParam.max(500).optional(),
      includeHeaders: z.boolean().optional(),
      headersOnly: z.boolean().optional(),
    },
    MailMessagesResultSchema,
    async ({ accountIds, unreadOnly, since, limitPerInbox, includeHeaders, headersOnly }) => {
      const items = await client.listInboxMessages({
        accountIds,
        unreadOnly: unreadOnly ?? false,
        since,
        limitPerInbox,
        includeHeaders: includeHeaders ?? false,
      });

      return {
        count: items.length,
        items: applyHeadersOnlyMode(items, headersOnly ?? false),
      };
    },
  );

  registerReadTool(
    server,
    "mail_get_message",
    "Get Message",
    "Return one full message by account identifier, mailbox path, and Mail message identifier.",
    {
      accountId: z.string(),
      mailboxPath: mailboxPathParam,
      messageId: positiveIntParam,
      includeHeaders: z.boolean().optional(),
    },
    MailMessageResultSchema,
    async ({ accountId, mailboxPath, messageId, includeHeaders }) => {
      const message = await client.getMessage(
        accountId,
        mailboxPath,
        messageId,
        includeHeaders ?? true,
      );

      return {
        message,
      };
    },
  );

  registerWriteTool(
    server,
    "mail_move_message",
    "Move Message",
    "Move one Mail message to another mailbox in the same account. The destination mailbox must be an explicit mailbox path and cannot be Trash or a deleted-messages mailbox.",
    {
      accountId: z.string(),
      mailboxPath: mailboxPathParam,
      messageId: positiveIntParam,
      destinationMailboxPath: moveDestinationMailboxPathParam,
    },
    MailMoveResultSchema,
    async ({ accountId, mailboxPath, messageId, destinationMailboxPath }) => {
      const move = await client.moveMessage({
        accountId,
        mailboxPath,
        destinationMailboxPath,
        messageId,
      });

      return {
        move,
      };
    },
    MOVE_TOOL_ANNOTATIONS,
  );
}
