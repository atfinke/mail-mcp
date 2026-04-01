import { z } from "zod";

export const MailAccessSchema = z.object({
  accessible: z.boolean(),
  count: z.number().int().nonnegative(),
  error: z.string().nullable().optional(),
});

export const MailRecipientSchema = z.object({
  name: z.string().nullable(),
  address: z.string().nullable(),
});

export const MailHeaderSchema = z.object({
  name: z.string(),
  content: z.string(),
});

export const MailAttachmentSchema = z.object({
  name: z.string().nullable(),
  mimeType: z.string().nullable(),
});

export const MailAccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  emailAddresses: z.array(z.string()),
  enabled: z.boolean(),
});

export const MailMailboxSchema = z.object({
  accountId: z.string(),
  accountName: z.string(),
  name: z.string(),
  path: z.string(),
  pathSegments: z.array(z.string()),
  unreadCount: z.number().int().nonnegative(),
  messageCount: z.number().int().nonnegative(),
  childCount: z.number().int().nonnegative(),
  isInbox: z.boolean(),
});

export const MailMessageSchema = z.object({
  id: z.number().int().nonnegative(),
  accountId: z.string(),
  accountName: z.string(),
  mailboxName: z.string(),
  mailboxPath: z.string(),
  mailboxPathSegments: z.array(z.string()),
  subject: z.string(),
  sender: z.string().nullable(),
  dateReceived: z.string().nullable(),
  dateSent: z.string().nullable(),
  read: z.boolean(),
  flagged: z.boolean(),
  deleted: z.boolean(),
  toRecipients: z.array(MailRecipientSchema),
  ccRecipients: z.array(MailRecipientSchema),
  bccRecipients: z.array(MailRecipientSchema),
  content: z.string(),
  headers: z.array(MailHeaderSchema),
  attachments: z.array(MailAttachmentSchema),
});

export const MailAccountsResultSchema = z.object({
  count: z.number().int().nonnegative(),
  items: z.array(MailAccountSchema),
});

export const MailMailboxesResultSchema = z.object({
  count: z.number().int().nonnegative(),
  items: z.array(MailMailboxSchema),
});

export const MailMessagesResultSchema = z.object({
  count: z.number().int().nonnegative(),
  items: z.array(MailMessageSchema),
});

export const MailMessageResultSchema = z.object({
  message: MailMessageSchema,
});

export const MailDraftSchema = z.object({
  id: z.number().int().nonnegative(),
  kind: z.enum(["compose", "reply", "forward"]),
  visible: z.boolean(),
  sender: z.string().nullable(),
  subject: z.string(),
  toRecipients: z.array(MailRecipientSchema),
  ccRecipients: z.array(MailRecipientSchema),
  bccRecipients: z.array(MailRecipientSchema),
  content: z.string(),
});

export const MailDraftResultSchema = z.object({
  draft: MailDraftSchema,
});

export type MailAccess = z.infer<typeof MailAccessSchema>;
export type MailAccount = z.infer<typeof MailAccountSchema>;
export type MailMailbox = z.infer<typeof MailMailboxSchema>;
export type MailMessage = z.infer<typeof MailMessageSchema>;
export type MailDraft = z.infer<typeof MailDraftSchema>;
