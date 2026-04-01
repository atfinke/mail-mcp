# Mail MCP

Local MCP server for macOS Mail reads plus visible unsent compose, reply, and forward drafts.

Built entirely by OpenAI GPT-5.4 via Codex.

## Overview

This project exposes Apple Mail accounts, mailboxes, inbox messages, and direct message reads through MCP.

Supported tools:

- `mail_check_access`
- `mail_list_accounts`
- `mail_list_mailboxes`
- `mail_list_mailbox_messages`
- `mail_list_inbox_messages`
- `mail_get_message`
- `mail_compose_message`
- `mail_reply_to_message`
- `mail_forward_message`

The primary read workflow is `mail_list_inbox_messages`, which returns full messages for all inboxes and fetches inboxes in parallel with a small concurrency cap.

The compose workflow is intentionally narrow: the server can open visible unsent compose, reply, and forward drafts, but it does not expose any send tool.

## Requirements

- Node.js 20+
- macOS
- Mail.app configured with at least one account
- Automation permission to control Mail

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` if you want to override defaults:

   ```bash
   cp .env.example .env
   ```

3. Run local quality checks:

   ```bash
   npm run verify
   ```

4. Run a real Mail smoke test:

   ```bash
   npm run test:live
   ```

Optional environment variables:

- `MAIL_MCP_INBOX_CONCURRENCY`
- `MAIL_MCP_REQUEST_TIMEOUT_MS`

## Run

Start the server in development:

```bash
npm run dev
```

Build production output:

```bash
npm run build
npm start
```

## Permissions

The server talks to Mail through Apple Events via `osascript -l JavaScript`.

Run `mail_check_access` once after installation. On first use, macOS may prompt for permission to control Mail.

If the prompt does not appear automatically in your client, run this once in Terminal:

```bash
osascript -e 'tell application "Mail" to count every account'
```

The server now starts even before access is granted. Use `mail_check_access` to confirm permission state and get an actionable error message if macOS Automation consent is still pending.

## Verify

```bash
npm run verify
```

## Notes

- The filesystem-backed `~/Library/Mail` approach is intentionally not used here because it requires broader privacy access and depends on undocumented Mail storage details.
- Message bodies are returned for inbox and mailbox listing tools.
- Compose, reply, and forward tools always open visible drafts. Hidden draft mode is intentionally avoided because Mail does not clean up invisible compose objects reliably through automation.
- Raw headers are optional for list tools and default to `false`.
- Attachment metadata is included, but not attachment bytes.

## MCP Setup

The server runs over stdio.

Example client configuration for the built server:

```json
{
  "mcpServers": {
    "mail": {
      "command": "node",
      "args": ["/absolute/path/to/mail-mcp/dist/index.js"],
      "cwd": "/absolute/path/to/mail-mcp"
    }
  }
}
```

For local development without building first:

```json
{
  "mcpServers": {
    "mail": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"],
      "cwd": "/absolute/path/to/mail-mcp"
    }
  }
}
```
