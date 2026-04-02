import { z } from "zod";

import { isBlockedMoveDestinationMailboxPath } from "./mailboxSafety.js";

const recipientInputSchema = z.object({
  address: z.string().trim().min(1),
  name: z.string().trim().min(1).optional(),
});

const mailboxPathSchema = z.array(z.string()).min(1);
const moveDestinationMailboxPathSchema = mailboxPathSchema.refine(
  (pathSegments) => !isBlockedMoveDestinationMailboxPath(pathSegments),
  "Moving messages to Trash or deleted mailboxes is not allowed.",
);

const helperRequestVariants = [
  z.object({
    action: z.literal("probe"),
  }),
  z.object({
    action: z.literal("listAccounts"),
  }),
  z.object({
    action: z.literal("listMailboxes"),
    accountIds: z.array(z.string()).optional(),
  }),
  z.object({
    action: z.literal("listMessagesForMailbox"),
    accountId: z.string(),
    mailboxPathSegments: mailboxPathSchema,
    unreadOnly: z.boolean().optional(),
    since: z.string().optional(),
    limit: z.number().int().positive().optional(),
    includeHeaders: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("listInboxMessages"),
    accountIds: z.array(z.string()).optional(),
    unreadOnly: z.boolean().optional(),
    since: z.string().optional(),
    limitPerInbox: z.number().int().positive().optional(),
    includeHeaders: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("getMessage"),
    accountId: z.string(),
    mailboxPathSegments: mailboxPathSchema,
    messageId: z.number().int().positive(),
    includeHeaders: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("composeMessage"),
    accountId: z.string().optional(),
    sender: z.string().optional(),
    subject: z.string().optional(),
    body: z.string().optional(),
    toRecipients: z.array(recipientInputSchema).optional(),
    ccRecipients: z.array(recipientInputSchema).optional(),
    bccRecipients: z.array(recipientInputSchema).optional(),
  }),
  z.object({
    action: z.literal("replyToMessage"),
    accountId: z.string(),
    mailboxPathSegments: mailboxPathSchema,
    messageId: z.number().int().positive(),
    replyAll: z.boolean().optional(),
    sender: z.string().optional(),
    subject: z.string().optional(),
    ccRecipients: z.array(recipientInputSchema).optional(),
    bccRecipients: z.array(recipientInputSchema).optional(),
  }),
  z.object({
    action: z.literal("forwardMessage"),
    accountId: z.string(),
    mailboxPathSegments: mailboxPathSchema,
    messageId: z.number().int().positive(),
    sender: z.string().optional(),
    subject: z.string().optional(),
    toRecipients: z.array(recipientInputSchema).optional(),
    ccRecipients: z.array(recipientInputSchema).optional(),
    bccRecipients: z.array(recipientInputSchema).optional(),
  }),
  z.object({
    action: z.literal("moveMessage"),
    accountId: z.string(),
    mailboxPathSegments: mailboxPathSchema,
    destinationMailboxPathSegments: moveDestinationMailboxPathSchema,
    messageId: z.number().int().positive(),
  }),
] as const;

export const MailHelperRequestSchema = z.discriminatedUnion("action", helperRequestVariants);
export type MailHelperRequest = z.infer<typeof MailHelperRequestSchema>;
