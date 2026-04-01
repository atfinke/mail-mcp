interface OsaErrorMetadata {
  stderr?: string;
  stdout?: string;
}

export class MailAutomationError extends Error {
  constructor(
    readonly kind: "permission" | "timeout" | "other",
    message: string,
  ) {
    super(message);
    this.name = "MailAutomationError";
  }
}

export function describeAutomationError(error: unknown): string {
  if (error instanceof Error) {
    const metadata = error as Error & OsaErrorMetadata;
    const parts = [error.message];

    if (metadata.stderr?.trim()) {
      parts.push(metadata.stderr.trim());
    }

    if (metadata.stdout?.trim()) {
      parts.push(metadata.stdout.trim());
    }

    return parts.join(": ");
  }

  return String(error);
}

export function classifyAutomationFailure(rawMessage: string): MailAutomationError {
  const lower = rawMessage.toLowerCase();

  if (
    lower.includes("mail automation permission is not granted") ||
    lower.includes("-1743") ||
    lower.includes("not authorized to send apple events") ||
    lower.includes("err aeeventnotpermitted") ||
    lower.includes("erraeeventnotpermitted")
  ) {
    return new MailAutomationError(
      "permission",
      "Mail automation permission is not granted. Open Mail and run `mail_check_access`, or launch MailMCPHelperApp directly once to trigger the macOS consent prompt.",
    );
  }

  if (lower.includes("mail automation timed out") || lower.includes("timed out")) {
    return new MailAutomationError(
      "timeout",
      "Mail automation timed out. Mail may be waiting on a macOS consent prompt or may be slow to respond.",
    );
  }

  return new MailAutomationError("other", rawMessage);
}
