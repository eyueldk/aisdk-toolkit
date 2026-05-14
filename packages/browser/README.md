# @aitoolkit/browser

[![npm](https://img.shields.io/npm/v/@aitoolkit/browser)](https://www.npmjs.com/package/@aitoolkit/browser)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

[**puppeteer-core**](https://pptr.dev/) **browser tools** for the [Vercel AI SDK](https://ai-sdk.dev) (`generateText`, `streamText`, `ToolLoopAgent`, …). This library does **not** download Chromium—point `launch` at an installed Chrome/Chromium (or install [`puppeteer`](https://www.npmjs.com/package/puppeteer) separately in your app if you want managed downloads).

**Repository:** [github.com/eyueldk/aitoolkit](https://github.com/eyueldk/aitoolkit) (`packages/browser`)

## Install

```bash
pnpm add @aitoolkit/browser
# or
npm install @aitoolkit/browser
```

**Requirements:** Node.js **20+**. Runtime dependency is **`puppeteer-core`** only (no bundled browser). Supply **`executablePath`** (or **`channel`** where supported) when calling **`launch`**, e.g. Chrome stable on your server or a path from [`@puppeteer/browsers`](https://www.npmjs.com/package/@puppeteer/browsers).

When **developing this repo**, **`puppeteer`** is a devDependency so tests can launch the downloaded Chromium; with **pnpm 10.1+**, you may need **`pnpm approve-builds --all`** if install skips Puppeteer’s postinstall scripts.

## Usage

1. Launch **`puppeteer-core`** against your Chrome/Chromium and open a `Page`.
2. Wrap it in **`Session`** (starts console + network capture).
3. Call **`createBrowserTools({ session })`** and pass the result as **`tools`** to the AI SDK.
4. Call **`session.close()`** before **`browser.close()`**.

```ts
import { generateText, stepCountIs } from "ai";
import { launch } from "puppeteer-core";
import { createBrowserTools, Session } from "@aitoolkit/browser";

const browser = await launch({
  headless: true,
  executablePath: process.env.CHROME_PATH, // or a fixed path to chrome / chromium
});
const page = await browser.newPage();
const session = new Session({ page });
const tools = createBrowserTools({ session });

try {
  await generateText({
    model: yourLanguageModel, // any AI SDK-compatible chat model
    tools,
    stopWhen: stepCountIs(10),
    prompt: "Open https://example.com and return the visible h1 text.",
  });
} finally {
  session.close();
  await browser.close();
}
```

Use **`createBrowserTools` once per `Session`** so every tool targets the same page and inspectors.

### Choosing a model

This package does not ship a provider. Install whichever AI SDK provider you use (e.g. `@ai-sdk/openai`, `@openrouter/ai-sdk-provider`) and pass its model as `model`.

### Built-in tools (`createBrowserTools`)

| Key | Role |
|-----|------|
| `goto` | Navigate to a URL (`viewAfter` optional). |
| `click` | Click via CSS selector (`viewAfter` optional). |
| `type` | Type into an input via CSS selector (`viewAfter` optional). |
| `evaluate` | Run `page.evaluate` script (`viewAfter` optional). |
| `viewPage` | Simplified view of “interesting” elements. |
| `inspectHTML` | Outer HTML for a selector or whole document. |
| `getScreenshot` | JPEG screenshot (see below). |
| `inspectConsole` | Buffered console messages from the session. |
| `inspectNetwork` | Network log entries (optional filters / limit). |
| `getCookies` | Current cookies as JSON. |

Several tools accept **`viewAfter: true`** to append the same simplified page view after the action.

### Custom tool sets

Import factories and build your own map:

`createGotoTool`, `createClickTool`, `createTypeTool`, `createEvaluateTool`, `createGetCookiesTool`, `createViewPageTool`, `createGetScreenshotTool`, `createInspectHTMLTool`, `createInspectConsoleTool`, `createInspectNetworkTool`

Each takes `{ session }` where `session` is your **`Session`** instance.

### Screenshots and multimodal models

`getScreenshot` returns base64 JPEG from `execute` and implements **`toModelOutput`** so compatible models receive **`image-data`** parts alongside text.

### Lifecycle

**`Session`** attaches listeners in its constructor. **`session.close()`** stops network/console inspectors—call it when tearing down, typically in `finally` before closing the browser.

## Scripts

| Command | Purpose |
|---------|---------|
| `pnpm build` | Build `dist/` (tsdown). |
| `pnpm check` | `tsc --noEmit`. |
| `pnpm test` | Vitest (Puppeteer tests; optional live agent test). |

Integration tests under `tests/agent.test.ts` use **`generateText`** + **`@openrouter/ai-sdk-provider`** and **`google/gemini-2.5-flash-lite`**. That suite is **skipped** unless **`OPENROUTER_API_KEY`** is set. The agent test imports **`dotenv/config`**, so a local **`.env`** with that variable is picked up when you run **`pnpm test`**.

## Migrating from LangChain (`langchainjs-browsing`)

Replace **`createBrowsingMiddleware({ page })`** with **`new Session({ page })`** + **`createBrowserTools({ session })`**. Pass tools into AI SDK **`tools`**; call **`session.close()`** on teardown. Tool images moved from LangChain messages to AI SDK **`tool()`** + **`toModelOutput`** (`image-data`).

## License

MIT — see [LICENSE](./LICENSE).
