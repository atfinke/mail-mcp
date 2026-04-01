import "dotenv/config";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadConfig } from "./config.js";
import { MailClient } from "./mail/client.js";
import { APP_NAME } from "./meta.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new MailClient(config);
  const access = await client.checkAccess();

  if (access.accessible) {
    console.error(`Authenticated to Mail with ${access.count} account(s)`);
  } else {
    console.error(`Mail access is not ready yet: ${access.error ?? "unknown Mail automation error"}`);
  }

  const server = createServer(client);
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error(`${APP_NAME} is running on stdio`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
