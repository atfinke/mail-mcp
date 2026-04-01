export const MAIL_JXA_SCRIPT = String.raw`
ObjC.import("stdlib");

function readInput() {
  const raw = $.getenv("MAIL_MCP_INPUT_JSON");
  if (!raw) {
    return {};
  }

  return JSON.parse(ObjC.unwrap(raw));
}

function toNullableString(value) {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value);
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }

  return fallback;
}

function toBoolean(value) {
  return Boolean(value);
}

function safeCall(getter, fallback) {
  try {
    return getter();
  } catch (error) {
    return fallback;
  }
}

function toList(value) {
  if (value === null || value === undefined) {
    return [];
  }

  return Array.from(value);
}

function safeList(getter) {
  return toList(safeCall(getter, []));
}

function dateToIso(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function isInboxName(name) {
  return typeof name === "string" && name.trim().toLowerCase() === "inbox";
}

function buildPath(pathSegments) {
  return pathSegments.join(" / ");
}

function recipientToJson(recipient) {
  return {
    name: toNullableString(safeCall(() => recipient.name(), null)),
    address: toNullableString(safeCall(() => recipient.address(), null)),
  };
}

function headerToJson(header) {
  return {
    name: String(safeCall(() => header.name(), "")),
    content: String(safeCall(() => header.content(), "")),
  };
}

function attachmentToJson(attachment) {
  let mimeType = null;

  try {
    mimeType = toNullableString(attachment.mimeType());
  } catch (error) {
    mimeType = null;
  }

  return {
    name: toNullableString(attachment.name()),
    mimeType,
  };
}

function draftToJson(kind, message) {
  return {
    id: toNumber(safeCall(() => message.id(), 0), 0),
    kind,
    visible: toBoolean(safeCall(() => message.visible(), false)),
    sender: toNullableString(safeCall(() => message.sender(), null)),
    subject: toNullableString(safeCall(() => message.subject(), null)) ?? "",
    toRecipients: safeList(() => message.toRecipients()).map(recipientToJson),
    ccRecipients: safeList(() => message.ccRecipients()).map(recipientToJson),
    bccRecipients: safeList(() => message.bccRecipients()).map(recipientToJson),
    content: toNullableString(safeCall(() => message.content(), null)) ?? "",
  };
}

function messageToJson(account, mailbox, pathSegments, message, options) {
  const includeHeaders = Boolean(options.includeHeaders);
  const headers = includeHeaders ? safeList(() => message.headers()).map(headerToJson) : [];

  return {
    id: toNumber(safeCall(() => message.id(), 0), 0),
    accountId: String(account.id()),
    accountName: String(account.name()),
    mailboxName: String(mailbox.name()),
    mailboxPath: buildPath(pathSegments),
    mailboxPathSegments: pathSegments,
    subject: toNullableString(safeCall(() => message.subject(), null)) ?? "",
    sender: toNullableString(safeCall(() => message.sender(), null)),
    dateReceived: dateToIso(safeCall(() => message.dateReceived(), null)),
    dateSent: dateToIso(safeCall(() => message.dateSent(), null)),
    read: toBoolean(safeCall(() => message.readStatus(), false)),
    flagged: toBoolean(safeCall(() => message.flaggedStatus(), false)),
    deleted: toBoolean(safeCall(() => message.deletedStatus(), false)),
    toRecipients: safeList(() => message.toRecipients()).map(recipientToJson),
    ccRecipients: safeList(() => message.ccRecipients()).map(recipientToJson),
    bccRecipients: safeList(() => message.bccRecipients()).map(recipientToJson),
    content: toNullableString(safeCall(() => message.content(), null)) ?? "",
    headers,
    attachments: safeList(() => message.mailAttachments()).map(attachmentToJson),
  };
}

function resolveMessage(account, mailbox, messageId) {
  const targetMessageId = Number(messageId);

  for (const message of safeList(() => mailbox.messages())) {
    if (Number(safeCall(() => message.id(), -1)) === targetMessageId) {
      return message;
    }
  }

  return null;
}

function recipientProperties(input) {
  const properties = {
    address: String(input.address),
  };

  if (input.name) {
    properties.name = String(input.name);
  }

  return properties;
}

function appendRecipients(message, kind, recipients) {
  const items = toList(recipients);
  if (items.length === 0) {
    return;
  }

  let recipientCollection = null;
  let recipientFactory = null;

  switch (kind) {
    case "to":
      recipientCollection = message.toRecipients;
      recipientFactory = Application("Mail").ToRecipient;
      break;
    case "cc":
      recipientCollection = message.ccRecipients;
      recipientFactory = Application("Mail").CcRecipient;
      break;
    case "bcc":
      recipientCollection = message.bccRecipients;
      recipientFactory = Application("Mail").BccRecipient;
      break;
    default:
      throw new Error("Unsupported recipient kind.");
  }

  for (const recipient of items) {
    recipientCollection.push(recipientFactory(recipientProperties(recipient)));
  }
}

function resolveSender(mail, input) {
  if (input.sender) {
    return String(input.sender);
  }

  if (!input.accountId) {
    return null;
  }

  const account = resolveAccount(mail, input.accountId);
  const emailAddresses = safeList(() => account.emailAddresses()).map(String);
  if (emailAddresses.length === 0) {
    throw new Error("The requested Mail account has no configured email addresses.");
  }

  return emailAddresses[0];
}

function applyDraftEdits(mail, message, input) {
  const sender = resolveSender(mail, input);
  if (sender) {
    message.sender = sender;
  }

  if (typeof input.subject === "string") {
    message.subject = input.subject;
  }

  if (typeof input.body === "string") {
    message.content = input.body;
  }

  appendRecipients(message, "to", input.toRecipients);
  appendRecipients(message, "cc", input.ccRecipients);
  appendRecipients(message, "bcc", input.bccRecipients);
  message.visible = true;
}

function mailboxToJson(account, mailbox, pathSegments) {
  const children = safeList(() => mailbox.mailboxes());
  const name = String(mailbox.name());
  const messages = safeList(() => mailbox.messages());

  return {
    accountId: String(account.id()),
    accountName: String(account.name()),
    name,
    path: buildPath(pathSegments),
    pathSegments,
    unreadCount: toNumber(safeCall(() => mailbox.unreadCount(), 0), 0),
    messageCount: messages.length,
    childCount: children.length,
    isInbox: isInboxName(name),
  };
}

function resolveAccount(mail, accountId) {
  const account = mail.accounts().find((candidate) => String(candidate.id()) === String(accountId));
  if (!account) {
    throw new Error("No Mail account matched the requested accountId.");
  }

  return account;
}

function walkMailboxes(account, mailboxes, pathSegments, output) {
  for (const mailbox of mailboxes) {
    const currentPath = [...pathSegments, String(mailbox.name())];
    output.push(mailboxToJson(account, mailbox, currentPath));
    walkMailboxes(account, safeList(() => mailbox.mailboxes()), currentPath, output);
  }
}

function resolveMailbox(account, pathSegments) {
  let children = safeList(() => account.mailboxes());
  let mailbox = null;

  for (const segment of pathSegments) {
    mailbox = children.find((candidate) => String(candidate.name()) === String(segment));
    if (!mailbox) {
      throw new Error("No Mail mailbox matched the requested path.");
    }

    children = safeList(() => mailbox.mailboxes());
  }

  if (!mailbox) {
    throw new Error("Mailbox path was empty.");
  }

  return mailbox;
}

function parseSince(input) {
  if (!input.since) {
    return null;
  }

  const parsed = new Date(String(input.since));
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid since date.");
  }

  return parsed;
}

function shouldIncludeMessage(message, options, sinceDate) {
  if (options.unreadOnly && safeCall(() => message.readStatus(), false)) {
    return false;
  }

  if (sinceDate) {
    const dateReceived = new Date(String(safeCall(() => message.dateReceived(), "")));
    if (Number.isNaN(dateReceived.getTime()) || dateReceived < sinceDate) {
      return false;
    }
  }

  return true;
}

function listMessagesForMailbox(mail, input) {
  const account = resolveAccount(mail, input.accountId);
  const mailbox = resolveMailbox(account, input.mailboxPathSegments);
  const sinceDate = parseSince(input);
  const limit = input.limit === null || input.limit === undefined ? null : Number(input.limit);
  const output = [];

  for (const message of safeList(() => mailbox.messages())) {
    if (!shouldIncludeMessage(message, input, sinceDate)) {
      continue;
    }

    output.push(messageToJson(account, mailbox, input.mailboxPathSegments, message, input));
    if (limit !== null && output.length >= limit) {
      break;
    }
  }

  return { items: output };
}

function getMessage(mail, input) {
  const account = resolveAccount(mail, input.accountId);
  const mailbox = resolveMailbox(account, input.mailboxPathSegments);
  const message = resolveMessage(account, mailbox, input.messageId);

  if (message) {
    return {
      message: messageToJson(account, mailbox, input.mailboxPathSegments, message, input),
    };
  }

  return { message: null };
}

function composeMessage(mail, input) {
  const draft = mail.OutgoingMessage({ visible: true });
  mail.outgoingMessages.push(draft);
  applyDraftEdits(mail, draft, input);
  safeCall(() => mail.activate(), null);

  return {
    draft: draftToJson("compose", draft),
  };
}

function replyToMessage(mail, input) {
  const account = resolveAccount(mail, input.accountId);
  const mailbox = resolveMailbox(account, input.mailboxPathSegments);
  const source = resolveMessage(account, mailbox, input.messageId);

  if (!source) {
    throw new Error("No Mail message matched the requested reply target.");
  }

  const draft = mail.reply(source, {
    openingWindow: true,
    replyToAll: Boolean(input.replyAll),
  });
  applyDraftEdits(mail, draft, input);
  safeCall(() => mail.activate(), null);

  return {
    draft: draftToJson("reply", draft),
  };
}

function forwardMessage(mail, input) {
  const account = resolveAccount(mail, input.accountId);
  const mailbox = resolveMailbox(account, input.mailboxPathSegments);
  const source = resolveMessage(account, mailbox, input.messageId);

  if (!source) {
    throw new Error("No Mail message matched the requested forward target.");
  }

  const draft = mail.forward(source, {
    openingWindow: true,
  });
  applyDraftEdits(mail, draft, input);
  safeCall(() => mail.activate(), null);

  return {
    draft: draftToJson("forward", draft),
  };
}

function main() {
  const input = readInput();
  const mail = Application("Mail");

  switch (input.action) {
    case "probe": {
      return {
        accessible: true,
        count: mail.accounts().length,
      };
    }
    case "listAccounts": {
      const items = mail.accounts().map((account) => ({
        id: String(account.id()),
        name: String(account.name()),
        emailAddresses: safeList(() => account.emailAddresses()).map(String),
        enabled: toBoolean(account.enabled()),
      }));

      return { items };
    }
    case "listMailboxes": {
      const requestedIds = Array.isArray(input.accountIds)
        ? new Set(input.accountIds.map(String))
        : null;
      const output = [];

      for (const account of mail.accounts()) {
        const accountId = String(account.id());
        if (requestedIds && !requestedIds.has(accountId)) {
          continue;
        }

        walkMailboxes(account, safeList(() => account.mailboxes()), [], output);
      }

      return { items: output };
    }
    case "listMessagesForMailbox":
      return listMessagesForMailbox(mail, input);
    case "getMessage":
      return getMessage(mail, input);
    case "composeMessage":
      return composeMessage(mail, input);
    case "replyToMessage":
      return replyToMessage(mail, input);
    case "forwardMessage":
      return forwardMessage(mail, input);
    default:
      throw new Error("Unsupported Mail MCP action.");
  }
}

JSON.stringify(main());
`;
