export type SearchPromptOptions = {
  defaultLimit?: number;
  defaultSources?: Array<"web" | "news" | "images">;
};

const SEARCH_PROMPT_BASE = `# search tools

You can search the web with **search** when you need current information, documentation, or sources beyond the conversation.

- Use a focused **query** — prefer specific keywords over long questions.
- Results are grouped by **web**, **news**, and **images** when requested via **sources**.
- Cite URLs from results when answering the user.
- Prefer **search** over guessing when facts may have changed since your training data.`;

/** System prompt text for agents using the search toolkit. */
export function prompt(options?: SearchPromptOptions): string {
  const defaultLimit = options?.defaultLimit ?? 5;
  const defaultSources = options?.defaultSources ?? ["web"];

  return `${SEARCH_PROMPT_BASE}

## Configuration

- **defaultLimit:** ${defaultLimit}
- **defaultSources:** ${JSON.stringify(defaultSources)}`;
}
