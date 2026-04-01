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

The primary read workflow is `mail_list_inbox_messages`, which returns messages for all inboxes and supports `headersOnly: true` when you only need headers and metadata.

The compose workflow is intentionally narrow: the server can open visible unsent compose, reply, and forward drafts, but it does not expose any send tool.

## Requirements

- Node.js 20+
- macOS
- Mail.app configured with at least one account
- Automation permission to control Mail
- A signed `MailMCPHelperApp` build

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` if you want to override defaults:

   ```bash
   cp .env.example .env
   ```

3. Build the helper app:

   ```bash
   npm run build:helper-app
   ```

   The build script compiles the app unsigned, then signs the finished bundle with the first local `Apple Development` identity. Override that selection with `MAIL_MCP_CODESIGN_IDENTITY` if needed.

4. Run local quality checks:

   ```bash
   npm run verify
   ```

5. Run a real Mail smoke test:

   ```bash
   npm run test:live
   ```

Optional environment variables:

- `MAIL_MCP_REQUEST_TIMEOUT_MS`
- `MAIL_MCP_HELPER_TIMEOUT_MS`
- `MAIL_MCP_HELPER_APP_PATH`

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

The server launches a signed `MailMCPHelperApp` and runs Mail automation inside that app process. This keeps the macOS Automation/TCC boundary attached to the helper app instead of Terminal or the client process.

Run `mail_check_access` once after installation. On first use, macOS may prompt for permission to control Mail.

If the prompt does not appear automatically in your client, launch the helper app directly once:

```bash
open MailMCPHelperApp/build/Build/Products/Release/MailMCPHelperApp.app
```

The server starts even before access is granted. Use `mail_check_access` to confirm permission state and get an actionable error message if macOS Automation consent is still pending.

To re-run the consent flow on a test machine, reset Mail Apple Events permission for the helper app and then run `mail_check_access` again:

```bash
tccutil reset AppleEvents com.andrewfinke.mailmcphelper
```

After the reset, confirm that the macOS prompt names `MailMCPHelperApp`, then confirm System Settings shows `MailMCPHelperApp -> Mail`.

## Verify

```bash
npm run verify
```

## Notes

- The filesystem-backed `~/Library/Mail` approach is intentionally not used here because it requires broader privacy access and depends on undocumented Mail storage details.
- Message bodies are returned for inbox and mailbox listing tools unless `headersOnly: true` is set.
- Compose, reply, and forward tools always open visible drafts. Hidden draft mode is intentionally avoided because Mail does not clean up invisible compose objects reliably through automation.
- Raw headers are optional for list tools and default to `false`.
- Attachment metadata is included, but not attachment bytes.
- The helper app executes JavaScript for Automation in-process via `OSAKit`.

## MCP Setup

The server runs over stdio.

Example client configuration for the built server:

```json
{
  "mcpServers": {
    "mail": {
      "command": "node",
      "args": ["/absolute/path/to/mail-mcp/dist/index.js"],
      "cwd": "/absolute/path/to/mail-mcp",
      "env": {
        "MAIL_MCP_HELPER_APP_PATH": "/absolute/path/to/mail-mcp/MailMCPHelperApp/build/Build/Products/Release/MailMCPHelperApp.app"
      }
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
