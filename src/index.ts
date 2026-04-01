import "dotenv/config";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadConfig } from "./config.js";
import { MailClient } from "./mail/client.js";
import { APP_NAME } from "./meta.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new MailClient(config);
  try {
    const access = await client.checkAccess();

    if (access.accessible) {
      console.error(
        `Authenticated to Mail with ${access.count} account(s) using ${client.transportName} transport`,
      );
    } else {
      console.error(
        `Mail access is not ready yet via ${client.transportName} transport: ${access.error ?? "unknown Mail automation error"}`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Mail startup probe failed via ${client.transportName} transport: ${message}`);
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
