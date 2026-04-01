import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { MailClient } from "../mail/client.js";
import {
  MailAccessSchema,
  MailAccountsResultSchema,
  MailMailboxesResultSchema,
} from "../mail/types.js";
import { registerReadTool } from "./common.js";

export function registerAccountTools(server: McpServer, client: MailClient): void {
  registerReadTool(
    server,
    "mail_check_access",
    "Check Mail Access",
    "Probe Mail automation access by listing configured Mail accounts. The first invocation may trigger a macOS permission prompt.",
    {},
    MailAccessSchema,
    async () => client.checkAccess(),
  );

  registerReadTool(
    server,
    "mail_list_accounts",
    "List Mail Accounts",
    "List configured Mail accounts available through Mail automation.",
    {},
    MailAccountsResultSchema,
    async () => {
      const accounts = await client.listAccounts();
      return {
        count: accounts.length,
        items: accounts,
      };
    },
  );

  registerReadTool(
    server,
    "mail_list_mailboxes",
    "List Mailboxes",
    "List Mail mailboxes across all accounts or a filtered set of account identifiers.",
    {
      accountIds: z.array(z.string()).optional(),
      inboxesOnly: z.boolean().optional(),
    },
    MailMailboxesResultSchema,
    async ({ accountIds, inboxesOnly }) => {
      const mailboxes = await client.listMailboxes({ accountIds });
      const items = inboxesOnly ? mailboxes.filter((mailbox) => mailbox.isInbox) : mailboxes;

      return {
        count: items.length,
        items,
      };
    },
  );
}
