import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { MailClient } from "../mail/client.js";
import { MailDraftResultSchema } from "../mail/types.js";
import { positiveIntParam, registerWriteTool } from "./common.js";

const recipientInputSchema = z.object({
  address: z.string().trim().min(1, "Recipient address is required."),
  name: z.string().trim().min(1).optional(),
});

const mailboxPathSegmentsParam = z
  .array(z.string())
  .min(1, "Provide at least one mailbox path segment.");

export function registerComposeTools(server: McpServer, client: MailClient): void {
  registerWriteTool(
    server,
    "mail_compose_message",
    "Compose Message",
    "Open a visible unsent Mail compose window with optional sender, recipients, subject, and body prefilled. This tool never sends mail.",
    {
      accountId: z.string().optional(),
      sender: z.string().optional(),
      subject: z.string().optional(),
      body: z.string().optional(),
      toRecipients: z.array(recipientInputSchema).optional(),
      ccRecipients: z.array(recipientInputSchema).optional(),
      bccRecipients: z.array(recipientInputSchema).optional(),
    },
    MailDraftResultSchema,
    async ({ accountId, sender, subject, body, toRecipients, ccRecipients, bccRecipients }) => {
      const draft = await client.composeMessage({
        accountId,
        sender,
        subject,
        body,
        toRecipients,
        ccRecipients,
        bccRecipients,
      });

      return {
        draft,
      };
    },
  );

  registerWriteTool(
    server,
    "mail_reply_to_message",
    "Reply To Message",
    "Open a visible unsent Mail reply draft for one message. Pass mailboxPathSegments as an array of mailbox names and use the message object's id value as messageId. This tool never sends mail.",
    {
      accountId: z.string(),
      mailboxPathSegments: mailboxPathSegmentsParam,
      messageId: positiveIntParam,
      replyAll: z.boolean().optional(),
      sender: z.string().optional(),
      subject: z.string().optional(),
      ccRecipients: z.array(recipientInputSchema).optional(),
      bccRecipients: z.array(recipientInputSchema).optional(),
    },
    MailDraftResultSchema,
    async ({
      accountId,
      mailboxPathSegments,
      messageId,
      replyAll,
      sender,
      subject,
      ccRecipients,
      bccRecipients,
    }) => {
      const draft = await client.replyToMessage({
        accountId,
        mailboxPathSegments,
        messageId,
        replyAll: replyAll ?? false,
        sender,
        subject,
        ccRecipients,
        bccRecipients,
      });

      return {
        draft,
      };
    },
  );

  registerWriteTool(
    server,
    "mail_forward_message",
    "Forward Message",
    "Open a visible unsent Mail forward draft for one message with optional sender and recipients prefilled. Pass mailboxPathSegments as an array of mailbox names and use the message object's id value as messageId. This tool never sends mail.",
    {
      accountId: z.string(),
      mailboxPathSegments: mailboxPathSegmentsParam,
      messageId: positiveIntParam,
      sender: z.string().optional(),
      subject: z.string().optional(),
      toRecipients: z.array(recipientInputSchema).optional(),
      ccRecipients: z.array(recipientInputSchema).optional(),
      bccRecipients: z.array(recipientInputSchema).optional(),
    },
    MailDraftResultSchema,
    async ({
      accountId,
      mailboxPathSegments,
      messageId,
      sender,
      subject,
      toRecipients,
      ccRecipients,
      bccRecipients,
    }) => {
      const draft = await client.forwardMessage({
        accountId,
        mailboxPathSegments,
        messageId,
        sender,
        subject,
        toRecipients,
        ccRecipients,
        bccRecipients,
      });

      return {
        draft,
      };
    },
  );
}
