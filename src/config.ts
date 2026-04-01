import path from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

const thisFile = fileURLToPath(import.meta.url);
const thisDir = path.dirname(thisFile);

const envSchema = z.object({
  MAIL_MCP_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().max(300_000).optional(),
  MAIL_MCP_HELPER_TIMEOUT_MS: z.coerce.number().int().positive().max(300_000).optional(),
  MAIL_MCP_HELPER_APP_PATH: z.string().trim().min(1).optional(),
});

const DEFAULT_HELPER_APP_PATH = path.resolve(
  thisDir,
  "../MailMCPHelperApp/build/Build/Products/Release/MailMCPHelperApp.app",
);

export interface MailConfig {
  requestTimeoutMs: number;
  helperTimeoutMs: number;
  helperAppPath: string;
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

  const requestTimeoutMs = parsed.data.MAIL_MCP_REQUEST_TIMEOUT_MS ?? 30_000;

  return {
    requestTimeoutMs,
    helperTimeoutMs: parsed.data.MAIL_MCP_HELPER_TIMEOUT_MS ?? requestTimeoutMs,
    helperAppPath: parsed.data.MAIL_MCP_HELPER_APP_PATH ?? DEFAULT_HELPER_APP_PATH,
  };
}
