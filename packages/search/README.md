# @eyueldk/aisdk-toolkit-search

[![npm](https://img.shields.io/npm/v/@eyueldk/aisdk-toolkit-search)](https://www.npmjs.com/package/@eyueldk/aisdk-toolkit-search)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/eyueldk/aisdk-toolkit/blob/main/LICENSE)

Pluggable web search tools for the [Vercel AI SDK](https://ai-sdk.dev). Swap search backends via **`SearchAdapter`** implementations.

## Features

- **`createSearchToolkit({ adapter, defaultLimit?, defaultSources?, defaultTimeoutMs? })`** → `{ tools, prompt, state }`
- Tool: **`search`** — structured **`{ web?, news?, images? }`** hits
- Adapters: **Firecrawl** (`@mendable/firecrawl-js`) and **DuckDuckGo** (`duck-duck-scrape`, no API key)

## Install

```bash
pnpm add @eyueldk/aisdk-toolkit-search
```

Requires **Node 20+**.

## Quick start

```ts
import { generateText, stepCountIs } from "ai";
import { createSearchToolkit } from "@eyueldk/aisdk-toolkit-search";
import { FirecrawlSearch } from "@eyueldk/aisdk-toolkit-search/adapters/firecrawl";

const adapter = await FirecrawlSearch.create();
const { tools, prompt } = createSearchToolkit({ adapter });

await generateText({
  model: yourLanguageModel,
  tools,
  stopWhen: stepCountIs(10),
  system: `You can search the web.\n\n${prompt()}`,
  prompt: "What changed in the latest TypeScript release?",
});
```

## Adapters

Import adapters from subpaths so bundlers load only the backend you need:

| Subpath | Adapter |
| --- | --- |
| `@eyueldk/aisdk-toolkit-search/adapters/firecrawl` | **FirecrawlSearch** |
| `@eyueldk/aisdk-toolkit-search/adapters/duckduckgo` | **DuckDuckGoSearch** |
| `@eyueldk/aisdk-toolkit-search/adapters` | **SearchAdapter** types only |

The main entry exports the toolkit and **SearchAdapter** — not concrete adapters.

| Adapter | Factory | Notes |
| --- | --- | --- |
| **FirecrawlSearch** | `await FirecrawlSearch.create({ apiKey?, apiUrl?, timeoutMs? })` | **`FIRECRAWL_API_KEY`** env var; optional **`FIRECRAWL_API_URL`** |
| **DuckDuckGoSearch** | `await DuckDuckGoSearch.create({ locale?, region?, marketRegion?, safeSearch?, timeoutMs? })` | No API key; uses **`duck-duck-scrape`** |

```ts
import { FirecrawlSearch } from "@eyueldk/aisdk-toolkit-search/adapters/firecrawl";

const adapter = await FirecrawlSearch.create({
  apiKey: process.env.FIRECRAWL_API_KEY,
});
```

```ts
import { DuckDuckGoSearch } from "@eyueldk/aisdk-toolkit-search/adapters/duckduckgo";

const adapter = await DuckDuckGoSearch.create({ marketRegion: "US" });
```

## Tool output

**`search`** returns a structured object (via AI SDK `outputSchema`):

| Field | Shape |
| --- | --- |
| **`web`** | `[{ url, title?, description? }]` |
| **`news`** | `[{ url?, title?, snippet?, date? }]` |
| **`images`** | `[{ url?, title?, imageUrl? }]` |

## Configuration

| Option | Default | Description |
| --- | --- | --- |
| **`defaultLimit`** | `5` | Max results per source when the tool omits **`limit`** |
| **`defaultSources`** | `["web"]` | Channels when the tool omits **`sources`** |
| **`defaultTimeoutMs`** | adapter default | Per-request timeout when the tool omits **`timeoutMs`** |

### `search` tool input

| Option | Description |
| --- | --- |
| **`query`** | Search query (required) |
| **`limit`** | Max results per source |
| **`sources`** | `web`, `news`, and/or `images` |
| **`includeDomains`** / **`excludeDomains`** | Domain filters |
| **`location`** | Geographic hint (e.g. `US`) |
| **`timeoutMs`** | Request timeout |

## License

MIT — [eyueldk/aisdk-toolkit](https://github.com/eyueldk/aisdk-toolkit)
