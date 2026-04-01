import "dotenv/config";

import { loadConfig } from "../src/config.js";
import { MailClient } from "../src/mail/client.js";

function summarizeMessage(
  message:
    | {
        id: number;
        accountName: string;
        mailboxPath: string;
        subject: string;
        sender: string | null;
        dateReceived: string | null;
        read: boolean;
        flagged: boolean;
      }
    | null,
) {
  if (!message) {
    return null;
  }

  return {
    id: message.id,
    accountName: message.accountName,
    mailboxPath: message.mailboxPath,
    subject: message.subject,
    sender: message.sender,
    dateReceived: message.dateReceived,
    read: message.read,
    flagged: message.flagged,
  };
}

async function main(): Promise<void> {
  const client = new MailClient(loadConfig(process.env));
  const access = await client.checkAccess();

  if (!access.accessible) {
    throw new Error(access.error ?? "Mail automation access is not available.");
  }

  const accounts = await client.listAccounts();
  const mailboxes = await client.listMailboxes();
  const inboxMessages = await client.listInboxMessages({
    limitPerInbox: 1,
    includeHeaders: false,
  });

  console.log(
    JSON.stringify(
      {
        access,
        accountCount: accounts.length,
        mailboxCount: mailboxes.length,
        inboxMessageCount: inboxMessages.length,
        sampleMessage: summarizeMessage(inboxMessages[0] ?? null),
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
