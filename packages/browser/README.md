# @eyueldk/aisdk-toolkit-browser

[![npm](https://img.shields.io/npm/v/@eyueldk/aisdk-toolkit-browser)](https://www.npmjs.com/package/@eyueldk/aisdk-toolkit-browser)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/eyueldk/aisdk-toolkit/blob/main/LICENSE)

Playwright-backed browser tools for the [Vercel AI SDK](https://ai-sdk.dev). Playwright ships with the package — consumers do not install it separately.

## Features

- **`createBrowserToolkit({ browserWSEndpoint? })`** → `{ tools, hint, state }` with **`state.browser`** (`BrowserInstance`)
- Page tools keyed by **`pageId`** (omit for the default page)
- **`viewPage`** / **`viewAfter`** formats: `simplified`, `accessibility`, `markdown` (Turndown + GFM)
- Console/network ring buffers; screenshot tool with multimodal output

## Install

```bash
pnpm add @eyueldk/aisdk-toolkit-browser
```

Requires **Node 20+**.

## Quick start

```ts
import { generateText, stepCountIs } from "ai";
import { createBrowserToolkit } from "@eyueldk/aisdk-toolkit-browser";

const { tools, hint, state } = createBrowserToolkit();

try {
  await generateText({
    model: yourLanguageModel,
    tools,
    stopWhen: stepCountIs(10),
    system: `You control browser pages.\n\n${hint}`,
    prompt: "Open https://example.com and return the visible h1 text.",
  });
} finally {
  await state.browser.close();
}
```

Attach to an existing browser (Browserless, remote Playwright, etc.):

```ts
createBrowserToolkit({ browserWSEndpoint: process.env.BROWSER_WS });
```

## Tools

Lifecycle: **`createContext`**, **`createPage`**, **`listContexts`**, **`closePage`**, **`closeContext`**.

Actions: **`goto`**, **`click`**, **`type`**, **`evaluate`**, **`viewPage`**, **`inspectHTML`**, **`getScreenshot`**, **`inspectConsole`**, **`inspectNetwork`**, **`getCookies`**.

## Configuration

| Option | Description |
| --- | --- |
| **`browserWSEndpoint`** | WebSocket URL to attach instead of launching Chromium locally |

## Migration (1.x → 2.0)

- Teardown: **`await state.browser.close()`** (was top-level **`browser`**).
- **`viewPage`** / **`viewAfter`**: use **`format`**, not **`mode`** (`simplified` \| `accessibility` \| `markdown`).

## Troubleshooting

- Local tests need Chromium once: `pnpm exec playwright install chromium` (from this package directory).

## License

MIT — [eyueldk/aisdk-toolkit](https://github.com/eyueldk/aisdk-toolkit)
