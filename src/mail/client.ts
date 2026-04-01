import type { MailConfig } from "../config.js";
import type {
  ComposeMessageOptions,
  ForwardMessageOptions,
  ListInboxMessagesOptions,
  ListMailboxMessagesOptions,
  ListMailboxesOptions,
  MailBackend,
  ReplyToMessageOptions,
} from "./backend.js";
import { HelperMailBackend } from "./helperBackend.js";
import type {
  MailAccess,
  MailAccount,
  MailDraft,
  MailMailbox,
  MailMessage,
} from "./types.js";

function createBackend(config: MailConfig): MailBackend {
  return new HelperMailBackend(config);
}

export class MailClient {
  private readonly backend: MailBackend;

  constructor(config: MailConfig, backend: MailBackend = createBackend(config)) {
    this.backend = backend;
  }

  get transportName(): "helper" {
    return this.backend.transportName;
  }

  checkAccess(): Promise<MailAccess> {
    return this.backend.checkAccess();
  }

  listAccounts(): Promise<MailAccount[]> {
    return this.backend.listAccounts();
  }

  listMailboxes(options: ListMailboxesOptions = {}): Promise<MailMailbox[]> {
    return this.backend.listMailboxes(options);
  }

  listMailboxMessages(options: ListMailboxMessagesOptions): Promise<MailMessage[]> {
    return this.backend.listMailboxMessages(options);
  }

  listInboxMessages(options: ListInboxMessagesOptions = {}): Promise<MailMessage[]> {
    return this.backend.listInboxMessages(options);
  }

  getMessage(
    accountId: string,
    mailboxPath: string[],
    messageId: number,
    includeHeaders = true,
  ): Promise<MailMessage> {
    return this.backend.getMessage(accountId, mailboxPath, messageId, includeHeaders);
  }

  composeMessage(options: ComposeMessageOptions = {}): Promise<MailDraft> {
    return this.backend.composeMessage(options);
  }

  replyToMessage(options: ReplyToMessageOptions): Promise<MailDraft> {
    return this.backend.replyToMessage(options);
  }

  forwardMessage(options: ForwardMessageOptions): Promise<MailDraft> {
    return this.backend.forwardMessage(options);
  }
}
