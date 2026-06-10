# @eyueldk/aisdk-toolkit-fetch

[![npm](https://img.shields.io/npm/v/@eyueldk/aisdk-toolkit-fetch)](https://www.npmjs.com/package/@eyueldk/aisdk-toolkit-fetch)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/eyueldk/aisdk-toolkit/blob/main/LICENSE)

HTTP fetch tools for the [Vercel AI SDK](https://ai-sdk.dev). Uses **`globalThis.fetch`** by default.

## Features

- **`createFetchToolkit({ fetch?, defaultTimeoutMs? })`** → `{ tools, prompt, state }`
- **`fetchRequest`**: **`path`** (URL) + optional **`query`**, **`method`**, **`headers`**, **`body`**, **`timeoutMs`**
- **`format`**: `raw` (default) or `markdown` (HTML → Markdown via linkedom + Turndown + GFM; works in Node and Cloudflare Workers)

## Install

```bash
pnpm add @eyueldk/aisdk-toolkit-fetch
```

Requires **Node 20+** (built-in `fetch`).

## Quick start

```ts
import { generateText, stepCountIs } from "ai";
import { createFetchToolkit } from "@eyueldk/aisdk-toolkit-fetch";

const { tools, prompt } = createFetchToolkit();

await generateText({
  model: yourLanguageModel,
  tools,
  stopWhen: stepCountIs(10),
  system: `You can fetch HTTP resources.\n\n${prompt()}`,
  prompt:
    "Fetch https://example.com with format markdown and summarize the page.",
});
```

With query parameters:

```ts
await tools.fetchRequest.execute({
  path: "https://api.example.com/search",
  query: { q: "cats", limit: 10 },
});
```

## Migration

### 2.0 → 2.1

- **`format: "markdown"`** parses HTML with **linkedom** before Turndown (no browser `document` required). Safe for Cloudflare Workers and other backend runtimes.

### 1.0 → 2.0

- Toolkit **`hint`** string replaced by **`prompt()`** — call **`prompt()`** in system/instructions. Standalone export: **`fetchPrompt()`** (replaces **`FETCH_HINT`**).

## Configuration

| Option | Default | Description |
| --- | --- | --- |
| **`fetch`** | `globalThis.fetch` | Custom fetch implementation |
| **`defaultTimeoutMs`** | `30_000` | Default request timeout |
| **`timeoutMs`** (per call) | toolkit default | Request timeout |
| **`format`** | `raw` | `markdown` converts HTML bodies only |

## License

MIT — [eyueldk/aisdk-toolkit](https://github.com/eyueldk/aisdk-toolkit)
