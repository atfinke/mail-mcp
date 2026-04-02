import { z } from "zod";

import type { MailConfig } from "../config.js";
import { runHelper } from "../helper.js";
import {
  classifyAutomationFailure,
  describeAutomationError,
  MailAutomationError,
} from "./automationError.js";
import type {
  ComposeMessageOptions,
  ForwardMessageOptions,
  ListInboxMessagesOptions,
  ListMailboxMessagesOptions,
  ListMailboxesOptions,
  MailBackend,
  MoveMessageOptions,
  ReplyToMessageOptions,
} from "./backend.js";
import { MailHelperRequestSchema } from "./helperActions.js";
import { assertAllowedMoveDestinationMailboxPath } from "./mailboxSafety.js";
import { sortMessagesNewestFirst } from "./normalize.js";
import {
  MailAccessSchema,
  MailAccountSchema,
  MailDraftSchema,
  MailMailboxSchema,
  MailMessageSchema,
  MailMoveSchema,
  type MailAccess,
  type MailAccount,
  type MailDraft,
  type MailMailbox,
  type MailMessage,
  type MailMove,
} from "./types.js";

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

const moveActionSchema = z.object({
  move: MailMoveSchema,
});

export class HelperMailBackend implements MailBackend {
  readonly transportName = "helper" as const;

  constructor(private readonly config: MailConfig) {}

  async checkAccess(): Promise<MailAccess> {
    try {
      const result = await this.invoke({ action: "probe" }, MailAccessSchema);
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

      const rawMessage = describeAutomationError(error);
      const classified = classifyAutomationFailure(rawMessage);
      if (classified.kind !== "other") {
        return {
          accessible: false,
          count: 0,
          error: classified.message,
        };
      }

      throw error;
    }
  }

  async listAccounts(): Promise<MailAccount[]> {
    const result = await this.invoke({ action: "listAccounts" }, listAccountsActionSchema);
    return [...result.items].sort((left, right) => left.name.localeCompare(right.name));
  }

  async listMailboxes(options: ListMailboxesOptions = {}): Promise<MailMailbox[]> {
    const result = await this.invoke(
      {
        action: "listMailboxes",
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
    const result = await this.invoke(
      {
        action: "listMessagesForMailbox",
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
    const result = await this.invoke(
      {
        action: "listInboxMessages",
        accountIds: options.accountIds,
        unreadOnly: options.unreadOnly ?? false,
        since: options.since,
        limitPerInbox: options.limitPerInbox,
        includeHeaders: options.includeHeaders ?? false,
      },
      listMessagesActionSchema,
    );

    return sortMessagesNewestFirst(result.items);
  }

  async getMessage(
    accountId: string,
    mailboxPath: string[],
    messageId: number,
    includeHeaders = true,
  ): Promise<MailMessage> {
    const result = await this.invoke(
      {
        action: "getMessage",
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
    const result = await this.invoke(
      {
        action: "composeMessage",
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
    const result = await this.invoke(
      {
        action: "replyToMessage",
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
    const result = await this.invoke(
      {
        action: "forwardMessage",
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

  async moveMessage(options: MoveMessageOptions): Promise<MailMove> {
    assertAllowedMoveDestinationMailboxPath(options.destinationMailboxPath);

    const result = await this.invoke(
      {
        action: "moveMessage",
        accountId: options.accountId,
        mailboxPathSegments: options.mailboxPath,
        destinationMailboxPathSegments: options.destinationMailboxPath,
        messageId: options.messageId,
      },
      moveActionSchema,
    );

    return result.move;
  }

  private async invoke<TSchema extends z.ZodTypeAny>(
    request: z.input<typeof MailHelperRequestSchema>,
    schema: TSchema,
  ): Promise<z.output<TSchema>> {
    const payload = MailHelperRequestSchema.parse(request);

    try {
      return await runHelper(payload, schema, {
        helperAppPath: this.config.helperAppPath,
        timeoutMs: this.config.helperTimeoutMs,
      });
    } catch (error) {
      const rawMessage = describeAutomationError(error);
      const classified = classifyAutomationFailure(rawMessage);
      if (classified.kind === "other") {
        throw new Error(`Mail helper action '${payload.action}' failed: ${rawMessage}`);
      }

      throw classified;
    }
  }
}
