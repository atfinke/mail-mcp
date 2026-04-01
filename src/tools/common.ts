import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { errorResponse, textResponse } from "./response.js";

type ToolSchema = z.ZodRawShape;
type ToolArgs<TSchema extends ToolSchema> = z.output<z.ZodObject<TSchema>>;
type ToolResult = ReturnType<typeof textResponse> | ReturnType<typeof errorResponse>;

export function createToolResultSchema<TSchema extends z.ZodTypeAny>(resultSchema: TSchema) {
  return z.object({
    result: resultSchema,
  });
}

export const READ_ONLY_TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export const WRITE_TOOL_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

export const positiveIntParam = z.coerce.number().int().positive();
export const optionalDateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/u, "Expected YYYY-MM-DD or ISO-8601 datetime")
  .optional();

export function registerReadTool<TSchema extends ToolSchema, TResult>(
  server: McpServer,
  name: string,
  title: string,
  description: string,
  inputSchema: TSchema,
  resultSchema: z.ZodType<TResult>,
  handler: (args: ToolArgs<TSchema>) => Promise<TResult>,
  annotations: ToolAnnotations = READ_ONLY_TOOL_ANNOTATIONS,
): void {
  const registerTool = server.registerTool.bind(server) as <
    TArgs extends ToolSchema,
    TOutput extends z.ZodTypeAny,
  >(
    toolName: string,
    config: {
      title: string;
      description: string;
      inputSchema: TArgs;
      outputSchema: TOutput;
      annotations: ToolAnnotations;
    },
    callback: (args: ToolArgs<TArgs>) => Promise<ToolResult>,
  ) => void;

  registerTool(
    name,
    {
      title,
      description,
      inputSchema,
      outputSchema: createToolResultSchema(resultSchema),
      annotations,
    },
    async (args) => {
      try {
        return textResponse(await handler(args));
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}

export function registerWriteTool<TSchema extends ToolSchema, TResult>(
  server: McpServer,
  name: string,
  title: string,
  description: string,
  inputSchema: TSchema,
  resultSchema: z.ZodType<TResult>,
  handler: (args: ToolArgs<TSchema>) => Promise<TResult>,
  annotations: ToolAnnotations = WRITE_TOOL_ANNOTATIONS,
): void {
  registerReadTool(server, name, title, description, inputSchema, resultSchema, handler, annotations);
}
