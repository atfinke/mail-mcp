import { execFile } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { z } from "zod";

const execFileAsync = promisify(execFile);
const HELPER_POLL_INTERVAL_MS = 100;
const HELPER_MAX_BUFFER_BYTES = 10 * 1024 * 1024;

interface HelperLaunchOptions {
  helperAppPath: string;
  timeoutMs: number;
}

function helperExecutablePath(helperAppPath: string): string {
  return path.join(helperAppPath, "Contents", "MacOS", "MailMCPHelperApp");
}

function describeUnknownError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return String(error);
}

function parseHelperErrorPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const maybeError = (payload as { error?: unknown }).error;
  if (typeof maybeError === "string" && maybeError.trim()) {
    return maybeError.trim();
  }

  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHelperResponse<TSchema extends z.ZodTypeAny>(
  responsePath: string,
  schema: TSchema,
  timeoutMs: number,
): Promise<z.output<TSchema>> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const raw = await readFile(responsePath, "utf8");
      if (!raw.trim()) {
        await sleep(HELPER_POLL_INTERVAL_MS);
        continue;
      }

      const payload = JSON.parse(raw) as unknown;
      const helperError = parseHelperErrorPayload(payload);
      if (helperError) {
        throw new Error(helperError);
      }

      return schema.parse(payload);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: string }).code === "ENOENT"
      ) {
        // The helper app has not written the response yet.
      } else {
        throw error;
      }
    }

    await sleep(HELPER_POLL_INTERVAL_MS);
  }

  throw new Error(`Mail helper timed out waiting for app response at ${responsePath}`);
}

export async function ensureHelperExists(options: HelperLaunchOptions): Promise<void> {
  try {
    await access(helperExecutablePath(options.helperAppPath), fsConstants.R_OK | fsConstants.X_OK);
  } catch {
    throw new Error(
      `Missing Mail helper app executable at ${helperExecutablePath(options.helperAppPath)}. Build it first with 'npm run build:helper-app'.`,
    );
  }
}

export async function runHelper<TSchema extends z.ZodTypeAny>(
  request: unknown,
  schema: TSchema,
  options: HelperLaunchOptions,
): Promise<z.output<TSchema>> {
  await ensureHelperExists(options);

  const tempDir = await mkdtemp(path.join(tmpdir(), "mail-mcp-helper-app-"));
  const requestPath = path.join(tempDir, "request.json");
  const responsePath = path.join(tempDir, "response.json");

  await writeFile(requestPath, JSON.stringify(request), "utf8");

  const args = [
    "-n",
    "-a",
    options.helperAppPath,
    "--args",
    "--request-path",
    requestPath,
    "--response-path",
    responsePath,
  ];

  try {
    await execFileAsync("open", args, {
      maxBuffer: HELPER_MAX_BUFFER_BYTES,
      timeout: options.timeoutMs,
    });

    return await waitForHelperResponse(responsePath, schema, options.timeoutMs);
  } catch (error) {
    const errorMessage =
      error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : typeof error === "string"
          ? error
          : "";

    if (errorMessage) {
      throw new Error(errorMessage);
    }

    if (error && typeof error === "object" && "stderr" in error) {
      const stderr = String((error as { stderr?: string }).stderr ?? "");
      const timeoutSuffix = "killed" in error && error.killed ? " (timed out)" : "";
      if (stderr) {
        throw new Error(`Failed to launch Mail helper app${timeoutSuffix}: ${stderr.trim()}`);
      }
    }

    throw new Error(`Mail helper launch failed: ${describeUnknownError(error)}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
