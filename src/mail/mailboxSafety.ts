function normalizeMailboxName(name: string): string {
  return name.trim().toLowerCase().replaceAll(/\s+/gu, " ");
}

const blockedDestinationMailboxNames = new Set([
  "trash",
  "deleted",
  "deleted items",
  "deleted messages",
]);

export function isBlockedMoveDestinationMailboxPath(pathSegments: string[]): boolean {
  return pathSegments.some((segment) => blockedDestinationMailboxNames.has(normalizeMailboxName(segment)));
}

export function assertAllowedMoveDestinationMailboxPath(pathSegments: string[]): void {
  if (isBlockedMoveDestinationMailboxPath(pathSegments)) {
    throw new Error("Moving messages to Trash or deleted mailboxes is not allowed.");
  }
}
