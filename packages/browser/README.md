# @eyueldk/aisdk-toolkit-browser

[![npm](https://img.shields.io/npm/v/@eyueldk/aisdk-toolkit-browser)](https://www.npmjs.com/package/@eyueldk/aisdk-toolkit-browser)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/eyueldk/aisdk-toolkit/blob/main/LICENSE)

Playwright-backed browser tools for the [Vercel AI SDK](https://ai-sdk.dev). Playwright ships with the package — consumers do not install it separately.

## Features

- **`createBrowserToolkit({ browserWsEndpoint? })`** → `{ tools, hint, state }` with **`state.browser`** (always created internally; launches Chromium or attaches over **CDP**)
- **Active page** model: action tools run on the active page; optional **`pageId`** / **`contextId`** on each action tool switch target first, or use **`selectPage`** / **`selectContext`**
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

Attach to an existing Chromium instance over CDP (e.g. `--remote-debugging-port=9222`):

```ts
createBrowserToolkit({ browserWsEndpoint: "http://127.0.0.1:9222" });
```

## Tools

Lifecycle: **`newContext`**, **`newPage`**, **`selectContext`**, **`selectPage`**, **`listContexts`**, **`closePage`** (active page), **`closeContext`** (active context).

Actions (active page; optional **`pageId`** / **`contextId`** shortcuts): **`goto`**, **`click`**, **`type`**, **`evaluate`**, **`viewPage`**, **`inspectHTML`**, **`getScreenshot`**, **`inspectConsole`**, **`inspectNetwork`**, **`getCookies`**.

### `evaluate` output

| Field | Description |
| --- | --- |
| **`value`** | JSON-serializable return value |
| **`undefined`** | `true` when the script returned no value |
| **`view`** | Optional page snapshot when **`viewAfter`** was set |
| **`error`** | Error message when execution failed |

Uses Playwright **`page.evaluate(script)`** directly (no custom `Function` wrapper). Prefer **`inspectHTML`** for DOM markup.

## Configuration

| Option | Description |
| --- | --- |
| **`browserWsEndpoint`** | CDP endpoint URL (`http://` or `ws://`); uses Playwright `connectOverCDP` instead of launching Chromium |

## Examples

Target a specific page when calling an action (no separate `selectPage` call):

```ts
await tools.goto.execute({
  pageId: "…from listContexts",
  url: "https://example.org",
});
```

## Migration

### 2.1 → 2.2

- **`evaluate`** returns structured **`{ value }`** or **`{ undefined: true }`** (via **`outputSchema`**); uses Playwright **`page.evaluate(script)`** directly.

### 2.1.x

- **`createBrowserToolkit`** no longer accepts a pre-built **`BrowserInstance`**; pass **`browserWsEndpoint`** only (renamed from **`browserWSEndpoint`**).
- Remote attach uses **`chromium.connectOverCDP`** (CDP endpoint), not **`chromium.connect`** (Playwright WebSocket).

### 2.0 → 2.1

- Lifecycle tools renamed: **`createContext`** → **`newContext`**, **`createPage`** → **`newPage`**; added **`selectContext`** / **`selectPage`**.
- Action tools use the **active** page by default. Pass optional **`pageId`** / **`contextId`** on an action to switch first, or call **`selectPage`** / **`selectContext`**.
- **`closePage`** / **`closeContext`** close the active page/context (no id arguments).

### 1.x → 2.0

- Teardown: **`await state.browser.close()`** (was top-level **`browser`**).
- **`viewPage`** / **`viewAfter`**: use **`format`**, not **`mode`** (`simplified` \| `accessibility` \| `markdown`).

## Troubleshooting

- Local tests need Chromium once: `pnpm exec playwright install chromium` (from this package directory).
- **`browserWsEndpoint`** must be a **CDP** URL (`http://127.0.0.1:9222` or `ws://…`), not a Playwright Browser-server WebSocket. Start Chromium with e.g. `--remote-debugging-port=9222`.

## License

MIT — [eyueldk/aisdk-toolkit](https://github.com/eyueldk/aisdk-toolkit)
