import { z } from "zod";

const envSchema = z.object({
  MAIL_MCP_INBOX_CONCURRENCY: z.coerce.number().int().positive().max(8).optional(),
  MAIL_MCP_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().max(300_000).optional(),
});

export interface MailConfig {
  inboxConcurrency: number;
  requestTimeoutMs: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): MailConfig {
  if (process.platform !== "darwin") {
    throw new Error("Mail MCP requires macOS because it automates Mail.app.");
  }

  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid Mail MCP configuration: ${message}`);
  }

  return {
    inboxConcurrency: parsed.data.MAIL_MCP_INBOX_CONCURRENCY ?? 2,
    requestTimeoutMs: parsed.data.MAIL_MCP_REQUEST_TIMEOUT_MS ?? 30_000,
  };
}
