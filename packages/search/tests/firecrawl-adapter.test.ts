import { describe, expect, test } from "vitest";
import { FirecrawlSearch } from "../src/adapters/firecrawl-adapter";

const firecrawlReady = Boolean(process.env.FIRECRAWL_API_KEY?.trim());

describe("FirecrawlSearch", () => {
  test("create requires an API key", async () => {
    const previous = process.env.FIRECRAWL_API_KEY;
    delete process.env.FIRECRAWL_API_KEY;

    await expect(FirecrawlSearch.create()).rejects.toThrow(/FIRECRAWL_API_KEY/);

    if (previous !== undefined) {
      process.env.FIRECRAWL_API_KEY = previous;
    }
  });
});

describe.skipIf(!firecrawlReady)("FirecrawlSearch live", () => {
  test("search returns web hits", async () => {
    const adapter = await FirecrawlSearch.create();
    const result = await adapter.search("typescript", {
      sources: ["web"],
      limit: 3,
    });

    expect(result.web?.length).toBeGreaterThan(0);
    expect(result.web?.[0]?.url).toMatch(/^https?:\/\//);
  });
});
