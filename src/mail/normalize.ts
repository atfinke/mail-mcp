import type { MailMessage } from "./types.js";

export function buildMailboxPath(pathSegments: string[]): string {
  return pathSegments.join(" / ");
}

export function isInboxMailboxName(name: string): boolean {
  return name.trim().toLowerCase() === "inbox";
}

export function normalizeIsoDateValue(value: string | Date | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

export function compareIsoDatesDescending(
  left: string | null | undefined,
  right: string | null | undefined,
): number {
  const leftValue = left ? new Date(left).getTime() : Number.NEGATIVE_INFINITY;
  const rightValue = right ? new Date(right).getTime() : Number.NEGATIVE_INFINITY;

  if (leftValue === rightValue) {
    return 0;
  }

  return leftValue > rightValue ? -1 : 1;
}

export function sortMessagesNewestFirst(messages: MailMessage[]): MailMessage[] {
  return [...messages].sort((left, right) => compareIsoDatesDescending(left.dateReceived, right.dateReceived));
}

export async function mapWithConcurrency<TItem, TResult>(
  items: TItem[],
  limit: number,
  mapper: (item: TItem, index: number) => Promise<TResult>,
): Promise<TResult[]> {
  if (limit < 1) {
    throw new Error("Concurrency limit must be at least 1.");
  }

  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;

      if (index >= items.length) {
        return;
      }

      results[index] = await mapper(items[index], index);
    }
  }

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
