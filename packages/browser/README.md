# @aimachine/browser

[![npm](https://img.shields.io/npm/v/@aimachine/browser)](https://www.npmjs.com/package/@aimachine/browser)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/eyueldk/aimachine/blob/main/LICENSE)

**Version:** `2.1.0` (also in `package.json` `"version"`).

**Puppeteer-backed browser toolkit** for the [Vercel AI SDK](https://ai-sdk.dev) (`generateText`, `streamText`, `ToolLoopAgent`, …): **`createBrowserToolkit({ page })`** returns **`{ tools, hint, session }`**. Types line up with the **`puppeteer`** package (Chromium install scripts unless you configure otherwise).

**Repository:** [github.com/eyueldk/aimachine](https://github.com/eyueldk/aimachine) (`packages/browser`)

## Requirements

| | |
| --- | --- |
| **Node** | 20+ (`engines.node`) |
| **Runtime deps** | `ai` ^6, `zod` ^4 |
| **Peer** | `puppeteer` ^24 (install next to this package for `Page` / `launch` types) |

## Install

```bash
pnpm add @aimachine/browser puppeteer
# or: npm install @aimachine/browser puppeteer
```

## Usage

1. `launch` and open a `Page`.
2. **`createBrowserToolkit({ page })`** — creates a **`Session`** (console + network capture), then returns **`{ tools, hint, session }`**. Pass **`tools`** and **`hint`** into the AI SDK.
3. **`await session.close()`** (stops inspectors and closes the page), then **`await browser.close()`**.

```ts
import { generateText, stepCountIs } from "ai";
import { launch } from "puppeteer";
import { createBrowserToolkit } from "@aimachine/browser";

const browser = await launch({ headless: true });
const page = await browser.newPage();
const { tools, hint, session } = createBrowserToolkit({ page });

try {
  await generateText({
    model: yourLanguageModel,
    tools,
    stopWhen: stepCountIs(10),
    system: `You control a browser tab.\n\n${hint}`,
    prompt: "Open https://example.com and return the visible h1 text.",
  });
} finally {
  await session.close();
  await browser.close();
}
```

Bring your own model provider (e.g. `@ai-sdk/openai`). Use **`createBrowserToolkit` once per `Page`** you automate. Import **`Session`** if you construct it yourself for **`createBrowserTools`**. **`createBrowserTools`** is still exported if you only need the raw tool map.

### Tools

`goto`, `click`, `type`, `evaluate`, `viewPage`, `inspectHTML`, `getScreenshot`, `inspectConsole`, `inspectNetwork`, `getCookies`. Several accept **`viewAfter: true`** to append a simplified page view after the action.

Individual factories (`createGotoTool`, `createClickTool`, …) are available if you want a custom tool set.

`getScreenshot` returns base64 JPEG and **`toModelOutput`** for multimodal models.

**Install note:** with pnpm 10.1+, you may need `pnpm approve-builds --all` so Puppeteer’s postinstall can download Chromium.

## Scripts

`pnpm build` · `pnpm check` (`tsc --noEmit`) · `pnpm test`. **`prepublishOnly`** runs `pnpm check && pnpm build` before publish.

## Publishing

CI publishes this package when **`packages/browser/**`** changes on **`main`** (see [`.github/workflows/publish.browser.yml`](https://github.com/eyueldk/aimachine/blob/main/.github/workflows/publish.browser.yml)) or via **workflow_dispatch**. Configure [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/) for that workflow.

## License

MIT — see [repository LICENSE](https://github.com/eyueldk/aimachine/blob/main/LICENSE).
