# quranbench MCP server

`packages/mcp` is a [Model Context Protocol](https://modelcontextprotocol.io)
server that lets an AI system ground its answers in the quranbench corpus. It is
a **thin wrapper over the public API** (`/api/v1`) — not a separate integration.
Every tool call is one HTTP request to an endpoint a third party can call too,
and every tool result carries the **corpus version** and the **query** that
produced it, so an AI's answer is attributable to a specific, reproducible
source.

If the server ever needs something the API cannot express, the fix is to add it
to the API — never to special-case the MCP server (docs/extensibility.md §6).

## Tools

| Tool                | Wraps                   | Purpose                                                           |
| ------------------- | ----------------------- | ----------------------------------------------------------------- |
| `search_corpus`     | `GET /search`           | Run a query in the corpus query language.                         |
| `get_verse`         | `GET /verse/{s}/{ayah}` | Fetch a verse or an inclusive range with tokens and translations. |
| `get_token`         | `GET /token/{id}`       | Fetch one token with full morphology.                             |
| `get_root`          | `GET /root/{slug}`      | Fetch a triliteral root and a page of its occurrences.            |
| `resolve_reference` | `GET /resolve?ref=`     | Resolve `2:43` / `2:43-45` to verses under the active scheme.     |
| `get_manifest`      | `GET /manifest`         | The build manifest: counts, sources, licences, checksums.         |

## Connecting

The server speaks MCP over stdio. Point any MCP client at it. By default it
targets the production API; set `QURANBENCH_API_BASE` to target another
deployment (for example a local dev server).

### Claude Desktop / Claude Code

Add to your MCP client configuration (e.g. `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "quranbench": {
      "command": "node",
      "args": ["--experimental-strip-types", "packages/mcp/src/index.ts"],
      "env": {
        "QURANBENCH_API_BASE": "https://quranbench.com/api/v1"
      }
    }
  }
}
```

Requires Node 22+ for `--experimental-strip-types` (to run the TypeScript entry
directly). Alternatively build the package to JS and point `args` at the output.

### Local development

Run the web app, then target it:

```bash
QURANBENCH_API_BASE=http://localhost:3000/api/v1 \
  node --experimental-strip-types packages/mcp/src/index.ts
```

## Worked example

Ask an AI connected to the server: _"How many times does the root ز ك و
(z-k-w) occur, and where does it first appear?"_

1. The AI calls `get_root` with `{ "slug": "z-k-w" }`.
2. The server issues `GET https://quranbench.com/api/v1/root/z-k-w`.
3. The tool returns:

   ```
   root ز ك و: 59 occurrences

   Attribution (so this answer is reproducible and citable):
     corpus_version: 0.6.0
     query: root z-k-w
     endpoint: /root/z-k-w
   ```

   followed by the full JSON body — the occurrence count, the surah
   distribution, the distinct forms, and the first page of occurrences with
   stable verse URLs.

4. The AI answers with the count **and** the attribution, so a reader can open
   `https://quranbench.com/root/z-k-w`, re-run the query, and confirm the number
   against corpus **v0.6.0**.

Because the corpus version travels with every result, an answer produced today
stays checkable even after the corpus is revised — the cited version keeps
resolving (see the [identifier policy](https://quranbench.com/identifiers)).

## Guarantees

- **Keyless.** No API key; the same generous published rate limits as the API.
- **Attributable.** Corpus version + query on every result.
- **Thin.** No endpoint reaches data a third party can't reach over HTTP.
- **Testable.** Tool handlers are pure and unit-tested against a fake API
  (`packages/mcp/src/tools.test.ts`) — no live server needed to verify them.
