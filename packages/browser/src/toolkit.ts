import { BrowserInstance } from "./browser/browser-instance";
import { prompt as browserPrompt } from "./hint";
import { createBrowserTools } from "./tools";

export type Toolkit<TTools extends Record<string, unknown>, TState> = {
  tools: TTools;
  prompt: () => string;
  state: TState;
};

export type BrowserTools = ReturnType<typeof createBrowserTools>;

export type BrowserToolkitState = {
  browser: BrowserInstance;
};

export type BrowserToolkit = Toolkit<BrowserTools, BrowserToolkitState>;

export type CreateBrowserToolkitOptions = {
  /** Chrome DevTools Protocol endpoint (`http://` or `ws://`) to attach via `connectOverCDP` instead of launching Chromium locally. */
  browserWsEndpoint?: string;
};

/**
 * Primary entry point: AI SDK `tools`, bundled `prompt()`, and `{ browser }` on `state`.
 * Pass `tools` and `prompt()` into the AI SDK; call `await state.browser.close()` when finished.
 */
export function createBrowserToolkit(
  options?: CreateBrowserToolkitOptions,
): BrowserToolkit {
  const browser = new BrowserInstance({
    browserWsEndpoint: options?.browserWsEndpoint,
  });
  const tools = createBrowserTools({ browser });
  return {
    tools,
    prompt: () =>
      browserPrompt({ browserWsEndpoint: options?.browserWsEndpoint }),
    state: { browser },
  };
}
