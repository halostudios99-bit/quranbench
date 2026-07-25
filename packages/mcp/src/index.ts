#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createServer } from './server.js';

// Entry point: connect the quranbench MCP server over stdio. The API base URL is
// taken from QURANBENCH_API_BASE, defaulting to the public production API — so
// out of the box the server grounds an AI on the live, attributable corpus.
async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('quranbench-mcp failed to start:', error);
  process.exit(1);
});
