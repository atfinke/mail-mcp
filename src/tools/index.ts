import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { MailClient } from "../mail/client.js";
import { registerAccountTools } from "./accountTools.js";
import { registerComposeTools } from "./composeTools.js";
import { registerMessageTools } from "./messageTools.js";

export function registerTools(server: McpServer, client: MailClient): void {
  registerAccountTools(server, client);
  registerMessageTools(server, client);
  registerComposeTools(server, client);
}
