import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { z } from "zod";

import type { MailConfig } from "../config.js";
import {
  MailAccessSchema,
  MailAccountSchema,
  MailAccountsResultSchema,
  MailDraftSchema,
  MailMailboxSchema,
  MailMailboxesResultSchema,
  MailMessageSchema,
  type MailAccess,
  type MailAccount,
  type MailDraft,
  type MailMailbox,
  type MailMessage,
} from "./types.js";
import { MAIL_JXA_SCRIPT } from "./jxa.js";
import { mapWithConcurrency, sortMessagesNewestFirst } from "./normalize.js";

const execFileAsync = promisify(execFile);
const MAX_BUFFER_BYTES = 100 * 1024 * 1024;

const listAccountsActionSchema = z.object({
  items: z.array(MailAccountSchema),
});

const listMailboxesActionSchema = z.object({
  items: z.array(MailMailboxSchema),
});

const listMessagesActionSchema = z.object({
  items: z.array(MailMessageSchema),
});

const getMessageActionSchema = z.object({
  message: MailMessageSchema.nullable(),
});

const draftActionSchema = z.object({
  draft: MailDraftSchema,
});

export interface ListMailboxesOptions {
  accountIds?: string[];
}

export interface MailRecipientInput {
  address: string;
  name?: string;
}

export interface ListMailboxMessagesOptions {
  accountId: string;
  mailboxPath: string[];
  unreadOnly?: boolean;
  since?: string;
  limit?: number;
  includeHeaders?: boolean;
}

export interface ListInboxMessagesOptions {
  accountIds?: string[];
  unreadOnly?: boolean;
  since?: string;
  limitPerInbox?: number;
  includeHeaders?: boolean;
}

export interface ComposeMessageOptions {
  accountId?: string;
  sender?: string;
  subject?: string;
  body?: string;
  toRecipients?: MailRecipientInput[];
  ccRecipients?: MailRecipientInput[];
  bccRecipients?: MailRecipientInput[];
}

export interface ReplyToMessageOptions {
  accountId: string;
  mailboxPath: string[];
  messageId: number;
  replyAll?: boolean;
  sender?: string;
  subject?: string;
  ccRecipients?: MailRecipientInput[];
  bccRecipients?: MailRecipientInput[];
}

export interface ForwardMessageOptions {
  accountId: string;
  mailboxPath: string[];
  messageId: number;
  sender?: string;
  subject?: string;
  toRecipients?: MailRecipientInput[];
  ccRecipients?: MailRecipientInput[];
  bccRecipients?: MailRecipientInput[];
}

interface OsaErrorMetadata {
  stderr?: string;
  stdout?: string;
  code?: number;
}

class MailAutomationError extends Error {
  constructor(
    readonly kind: "permission" | "timeout" | "other",
    message: string,
  ) {
    super(message);
    this.name = "MailAutomationError";
  }
}

function describeOsaError(error: unknown): string {
  if (error instanceof Error) {
    const metadata = error as Error & OsaErrorMetadata;
    const parts = [error.message];

    if (metadata.stderr?.trim()) {
      parts.push(metadata.stderr.trim());
    }

    if (metadata.stdout?.trim()) {
      parts.push(metadata.stdout.trim());
    }

    return parts.join(": ");
  }

  return String(error);
}

function classifyAutomationFailure(rawMessage: string): MailAutomationError {
  const lower = rawMessage.toLowerCase();

  if (
    lower.includes("-1743") ||
    lower.includes("not authorized to send apple events") ||
    lower.includes("err aeeventnotpermitted") ||
    lower.includes("erraeeventnotpermitted")
  ) {
    return new MailAutomationError(
      "permission",
      "Mail automation permission is not granted. Open Mail and run `mail_check_access`, or run `osascript -e 'tell application \"Mail\" to count every account'` once to trigger the macOS consent prompt.",
    );
  }

  if (lower.includes("timed out")) {
    return new MailAutomationError(
      "timeout",
      "Mail automation timed out. Mail may be waiting on a macOS consent prompt or may be slow to respond.",
    );
  }

  return new MailAutomationError("other", rawMessage);
}

export class MailClient {
  constructor(private readonly config: MailConfig) {}

  async checkAccess(): Promise<MailAccess> {
    try {
      const result = await this.runAction("probe", {}, MailAccessSchema);
      return {
        accessible: result.accessible,
        count: result.count,
        error: null,
      };
    } catch (error) {
      if (error instanceof MailAutomationError && error.kind !== "other") {
        return {
          accessible: false,
          count: 0,
          error: error.message,
        };
      }

      throw error;
    }
  }

  async listAccounts(): Promise<MailAccount[]> {
    const result = await this.runAction("listAccounts", {}, listAccountsActionSchema);
    return [...result.items].sort((left, right) => left.name.localeCompare(right.name));
  }

  async listMailboxes(options: ListMailboxesOptions = {}): Promise<MailMailbox[]> {
    const result = await this.runAction(
      "listMailboxes",
      {
        accountIds: options.accountIds,
      },
      listMailboxesActionSchema,
    );

    return [...result.items].sort((left, right) => {
      const accountComparison = left.accountName.localeCompare(right.accountName);
      if (accountComparison !== 0) {
        return accountComparison;
      }

      return left.path.localeCompare(right.path);
    });
  }

  async listMailboxMessages(options: ListMailboxMessagesOptions): Promise<MailMessage[]> {
    const result = await this.runAction(
      "listMessagesForMailbox",
      {
        accountId: options.accountId,
        mailboxPathSegments: options.mailboxPath,
        unreadOnly: options.unreadOnly ?? false,
        since: options.since,
        limit: options.limit,
        includeHeaders: options.includeHeaders ?? false,
      },
      listMessagesActionSchema,
    );

    return sortMessagesNewestFirst(result.items);
  }

  async listInboxMessages(options: ListInboxMessagesOptions = {}): Promise<MailMessage[]> {
    const mailboxes = await this.listMailboxes({
      accountIds: options.accountIds,
    });
    const inboxes = mailboxes.filter((mailbox) => mailbox.isInbox);

    const perMailboxMessages = await mapWithConcurrency(
      inboxes,
      this.config.inboxConcurrency,
      (mailbox) =>
        this.listMailboxMessages({
          accountId: mailbox.accountId,
          mailboxPath: mailbox.pathSegments,
          unreadOnly: options.unreadOnly ?? false,
          since: options.since,
          limit: options.limitPerInbox,
          includeHeaders: options.includeHeaders ?? false,
        }),
    );

    return sortMessagesNewestFirst(perMailboxMessages.flat());
  }

  async getMessage(accountId: string, mailboxPath: string[], messageId: number, includeHeaders = true): Promise<MailMessage> {
    const result = await this.runAction(
      "getMessage",
      {
        accountId,
        mailboxPathSegments: mailboxPath,
        messageId,
        includeHeaders,
      },
      getMessageActionSchema,
    );

    if (!result.message) {
      throw new Error(`No Mail message matched id ${messageId} in the requested mailbox.`);
    }

    return result.message;
  }

  async composeMessage(options: ComposeMessageOptions = {}): Promise<MailDraft> {
    const result = await this.runAction(
      "composeMessage",
      {
        accountId: options.accountId,
        sender: options.sender,
        subject: options.subject,
        body: options.body,
        toRecipients: options.toRecipients,
        ccRecipients: options.ccRecipients,
        bccRecipients: options.bccRecipients,
      },
      draftActionSchema,
    );

    return result.draft;
  }

  async replyToMessage(options: ReplyToMessageOptions): Promise<MailDraft> {
    const result = await this.runAction(
      "replyToMessage",
      {
        accountId: options.accountId,
        mailboxPathSegments: options.mailboxPath,
        messageId: options.messageId,
        replyAll: options.replyAll ?? false,
        sender: options.sender,
        subject: options.subject,
        ccRecipients: options.ccRecipients,
        bccRecipients: options.bccRecipients,
      },
      draftActionSchema,
    );

    return result.draft;
  }

  async forwardMessage(options: ForwardMessageOptions): Promise<MailDraft> {
    const result = await this.runAction(
      "forwardMessage",
      {
        accountId: options.accountId,
        mailboxPathSegments: options.mailboxPath,
        messageId: options.messageId,
        sender: options.sender,
        subject: options.subject,
        toRecipients: options.toRecipients,
        ccRecipients: options.ccRecipients,
        bccRecipients: options.bccRecipients,
      },
      draftActionSchema,
    );

    return result.draft;
  }

  private async runAction<TSchema extends z.ZodTypeAny>(
    action: string,
    payload: Record<string, unknown>,
    schema: TSchema,
  ): Promise<z.output<TSchema>> {
    const env = {
      ...process.env,
      MAIL_MCP_INPUT_JSON: JSON.stringify({
        action,
        ...payload,
      }),
    };

    try {
      const { stdout } = await execFileAsync(
        "osascript",
        ["-l", "JavaScript", "-e", MAIL_JXA_SCRIPT],
        {
          env,
          timeout: this.config.requestTimeoutMs,
          maxBuffer: MAX_BUFFER_BYTES,
        },
      );

      const trimmed = stdout.trim();
      if (!trimmed) {
        throw new Error(`Mail automation action '${action}' returned no output.`);
      }

      const parsed = JSON.parse(trimmed) as unknown;
      return schema.parse(parsed);
    } catch (error) {
      const rawMessage = describeOsaError(error);
      const classified = classifyAutomationFailure(rawMessage);

      if (classified.kind === "other") {
        throw new Error(`Mail automation action '${action}' failed: ${rawMessage}`);
      }

      throw classified;
    }
  }
}

export {
  MailAccountsResultSchema,
  MailMailboxesResultSchema,
};
