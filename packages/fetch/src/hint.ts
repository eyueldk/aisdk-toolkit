import { DEFAULT_FETCH_TIMEOUT_MS } from "./fetch";

export type FetchPromptOptions = {
  defaultTimeoutMs?: number;
};

const FETCH_PROMPT_BASE = `# fetch tools

You can perform HTTP requests with **fetchRequest**. Use it to read public APIs, documentation pages, JSON endpoints, and other web resources.

- Prefer **GET** for read-only retrieval unless the task requires another method.
- Check **status**, **headers**, and **body** in the tool result; non-2xx responses are still returned for inspection.
- Use **\`format: "markdown"\`** for a structured snapshot; HTML bodies are converted to Markdown, other types are left as-is in the body section. Default **\`raw\`** keeps plain sections.
- Large response bodies may be truncated in the tool output; narrow the request or use a more specific URL if you need more detail.
- Only request URLs the user or task legitimately needs; avoid hammering the same host with repeated calls.`;

/** System prompt text for agents using the fetch toolkit. */
export function prompt(options?: FetchPromptOptions): string {
  const defaultTimeoutMs =
    options?.defaultTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;

  return `${FETCH_PROMPT_BASE}

## Configuration

- **defaultTimeoutMs:** ${defaultTimeoutMs} — max runtime per request unless overridden on a call.`;
}
