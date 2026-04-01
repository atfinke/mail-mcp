import type {
  MailAccess,
  MailAccount,
  MailDraft,
  MailMailbox,
  MailMessage,
} from "./types.js";

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

export interface MailBackend {
  readonly transportName: "helper";
  checkAccess(): Promise<MailAccess>;
  listAccounts(): Promise<MailAccount[]>;
  listMailboxes(options?: ListMailboxesOptions): Promise<MailMailbox[]>;
  listMailboxMessages(options: ListMailboxMessagesOptions): Promise<MailMessage[]>;
  listInboxMessages(options?: ListInboxMessagesOptions): Promise<MailMessage[]>;
  getMessage(
    accountId: string,
    mailboxPath: string[],
    messageId: number,
    includeHeaders?: boolean,
  ): Promise<MailMessage>;
  composeMessage(options?: ComposeMessageOptions): Promise<MailDraft>;
  replyToMessage(options: ReplyToMessageOptions): Promise<MailDraft>;
  forwardMessage(options: ForwardMessageOptions): Promise<MailDraft>;
}
