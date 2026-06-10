import { describe, expect, test } from "vitest";
import {
  SearchAdapter,
  createSearchToolkit,
  createSearchTools,
  searchPrompt,
  type SearchQueryResult,
} from "../src/index";

const toolOpts = { toolCallId: "test", messages: [] } as const;

class StubSearch extends SearchAdapter {
  constructor(private readonly result: SearchQueryResult) {
    super();
  }

  override search(): Promise<SearchQueryResult> {
    return Promise.resolve(this.result);
  }
}

describe("createSearchToolkit", () => {
  test("returns tools, prompt, and state", () => {
    const adapter = new StubSearch({
      web: [{ url: "https://example.com", title: "Example" }],
    });
    const kit = createSearchToolkit({ adapter, defaultLimit: 3 });
    expect(kit.tools.search).toBeDefined();
    expect(kit.state.adapter).toBe(adapter);
    expect(kit.state.defaultLimit).toBe(3);
    expect(kit.prompt()).toBe(searchPrompt({ defaultLimit: 3 }));
    expect(kit.prompt()).toContain("search");
  });

  test("search tool returns structured hits", async () => {
    const adapter = new StubSearch({
      web: [
        {
          url: "https://example.com",
          title: "Example",
          description: "An example site",
        },
      ],
      news: [{ url: "https://news.example.com", title: "Headline" }],
    });
    const tools = createSearchTools({ adapter });

    const out = await tools.search.execute!(
      { query: "example topic" },
      { ...toolOpts, messages: [] },
    );

    expect(out).toEqual({
      web: [
        {
          url: "https://example.com",
          title: "Example",
          description: "An example site",
        },
      ],
      news: [{ url: "https://news.example.com", title: "Headline" }],
    });
  });

  test("search tool forwards options to the adapter", async () => {
    let capturedQuery = "";
    let capturedOptions: unknown;
    const adapter = new (class extends SearchAdapter {
      override search(query: string, options?: unknown) {
        capturedQuery = query;
        capturedOptions = options;
        return Promise.resolve({ web: [] });
      }
    })();

    const tools = createSearchTools({
      adapter,
      defaultLimit: 5,
      defaultSources: ["web"],
      defaultTimeoutMs: 30_000,
    });

    await tools.search.execute!(
      {
        query: "vitest",
        sources: ["news", "images"],
        limit: 2,
        includeDomains: ["example.com"],
        location: "US",
        timeoutMs: 10_000,
      },
      { ...toolOpts, messages: [] },
    );

    expect(capturedQuery).toBe("vitest");
    expect(capturedOptions).toEqual({
      limit: 2,
      sources: ["news", "images"],
      includeDomains: ["example.com"],
      excludeDomains: undefined,
      location: "US",
      timeoutMs: 10_000,
    });
  });
});
