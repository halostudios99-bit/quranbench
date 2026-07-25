import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z, type ZodRawShape, type ZodTypeAny } from 'zod';

import { ApiClient, type ApiClientOptions } from './client.js';
import { TOOLS, type ToolResult, type ToolSpec } from './tools.js';

// Wire the pure tool specs (tools.ts) into an MCP server. The server owns only
// protocol plumbing and formatting; all behaviour lives in the injectable tool
// handlers, which are unit-tested without a transport.

function zodShape(input: ToolSpec['input']): ZodRawShape {
  const shape: Record<string, ZodTypeAny> = {};
  for (const [key, spec] of Object.entries(input)) {
    let field: ZodTypeAny = spec.type === 'number' ? z.number() : z.string();
    field = field.describe(spec.description);
    if (!spec.required) field = field.optional();
    shape[key] = field;
  }
  return shape;
}

/** Format a tool result as MCP content, leading with the attribution line so an
 *  AI reading the result cannot use the data without the version and query. */
function formatResult(result: ToolResult) {
  const { corpus_version, query, endpoint } = result.attribution;
  const attribution =
    `${result.summary}\n\n` +
    `Attribution (so this answer is reproducible and citable):\n` +
    `  corpus_version: ${corpus_version}\n` +
    `  query: ${query}\n` +
    `  endpoint: ${endpoint}`;
  return {
    content: [
      { type: 'text' as const, text: attribution },
      { type: 'text' as const, text: JSON.stringify(result.data, null, 2) },
    ],
  };
}

export function createServer(options: ApiClientOptions = {}): McpServer {
  const client = new ApiClient(options);
  const server = new McpServer({
    name: 'quranbench',
    version: '1.0.0',
  });

  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: zodShape(tool.input),
      },
      async (args: Record<string, unknown>) => {
        try {
          const result = await tool.run(client, args);
          return formatResult(result);
        } catch (error) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error: ${(error as Error).message}`,
              },
            ],
            isError: true,
          };
        }
      },
    );
  }

  return server;
}
