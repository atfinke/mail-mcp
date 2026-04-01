import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { MailClient } from "../mail/client.js";
import { MailMessageResultSchema, MailMessagesResultSchema } from "../mail/types.js";
import { optionalDateParam, positiveIntParam, registerReadTool } from "./common.js";

const mailboxPathParam = z.array(z.string()).min(1, "Provide at least one mailbox path segment.");

export function registerMessageTools(server: McpServer, client: MailClient): void {
  registerReadTool(
    server,
    "mail_list_mailbox_messages",
    "List Mailbox Messages",
    "Return full messages for one specific Mail mailbox.",
    {
      accountId: z.string(),
      mailboxPath: mailboxPathParam,
      unreadOnly: z.boolean().optional(),
      since: optionalDateParam,
      limit: positiveIntParam.max(500).optional(),
      includeHeaders: z.boolean().optional(),
    },
    MailMessagesResultSchema,
    async ({ accountId, mailboxPath, unreadOnly, since, limit, includeHeaders }) => {
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
        items,
      };
    },
  );

  registerReadTool(
    server,
    "mail_list_inbox_messages",
    "List Inbox Messages",
    "Return full messages for every inbox mailbox, fetched in parallel with a small concurrency cap.",
    {
      accountIds: z.array(z.string()).optional(),
      unreadOnly: z.boolean().optional(),
      since: optionalDateParam,
      limitPerInbox: positiveIntParam.max(500).optional(),
      includeHeaders: z.boolean().optional(),
    },
    MailMessagesResultSchema,
    async ({ accountIds, unreadOnly, since, limitPerInbox, includeHeaders }) => {
      const items = await client.listInboxMessages({
        accountIds,
        unreadOnly: unreadOnly ?? false,
        since,
        limitPerInbox,
        includeHeaders: includeHeaders ?? false,
      });

      return {
        count: items.length,
        items,
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
}
