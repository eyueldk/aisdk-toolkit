import { describe, expect, test } from "vitest";
import { DuckDuckGoSearch } from "../src/adapters/duckduckgo-adapter";

describe("DuckDuckGoSearch", () => {
  test("create works without configuration", async () => {
    const adapter = await DuckDuckGoSearch.create();
    expect(adapter).toBeInstanceOf(DuckDuckGoSearch);
  });
});
