export type BrowserPromptOptions = {
  /** Chrome DevTools Protocol endpoint when attaching via `connectOverCDP`. */
  browserWsEndpoint?: string;
};

const BROWSER_PROMPT_BASE = `## Browser tools

You control real browser pages via Playwright-backed tools. **Action tools run on the active page** unless you pass optional \`pageId\` / \`contextId\` shortcuts (from \`listContexts\`) to switch before the action. Use \`selectPage\` / \`selectContext\` when you only need to switch.

- **Lifecycle:** \`newContext\`, \`newPage\` (creates and activates), \`selectContext\`, \`selectPage\`, \`listContexts\`, \`closePage\` (active page), \`closeContext\` (active context).
- **Navigation:** \`goto\` with a full URL.
- **Understanding the page:** \`viewPage\` (\`format\`: \`simplified\`, \`accessibility\`, or \`markdown\`), \`inspectHTML\` (prefer over \`evaluate\` for DOM markup), \`getScreenshot\` (multimodal).
- **Interaction:** \`click\` and \`type\` with CSS selectors. Use \`evaluate\` for small scripts; it returns \`{ value }\` or \`{ undefined: true }\` when the script has no return value.
- **Diagnostics:** \`inspectConsole\` and \`inspectNetwork\` read **recent ring buffers** (not full history); tool output may truncate large fields.
- **Cookies:** \`getCookies\` for the active page's context.

Several tools support \`viewAfter: { format: "simplified" | "accessibility" | "markdown" }\` to append a page view after the action.

Call \`listContexts\` to see context/page UUIDs before \`selectPage\` or \`selectContext\`. The host app should call \`await state.browser.close()\` when the run ends.`;

/** System prompt text for agents using the browser toolkit. */
export function prompt(options?: BrowserPromptOptions): string {
  if (!options?.browserWsEndpoint) {
    return BROWSER_PROMPT_BASE;
  }

  return `${BROWSER_PROMPT_BASE}

## Configuration

- **browserWsEndpoint:** \`${options.browserWsEndpoint}\` — attach to an existing Chromium over CDP (\`connectOverCDP\`) instead of launching locally.`;
}
