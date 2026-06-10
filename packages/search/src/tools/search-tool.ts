import { tool } from "ai";
import { z } from "zod";
import type { SearchSource } from "../adapters";
import type { CreateSearchToolsOptions } from "./index";

const SEARCH_DESCRIPTION =
  "Search the web for up-to-date information. Returns structured hits (web, news, and/or images) from the configured search adapter.";

const SearchSourceSchema = z.enum(["web", "news", "images"]);

const SearchWebHitSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
});

const SearchNewsHitSchema = z.object({
  url: z.string().optional(),
  title: z.string().optional(),
  snippet: z.string().optional(),
  date: z.string().optional(),
});

const SearchImageHitSchema = z.object({
  url: z.string().optional(),
  title: z.string().optional(),
  imageUrl: z.string().optional(),
});

const SearchOutputSchema = z.object({
  web: z.array(SearchWebHitSchema).optional(),
  news: z.array(SearchNewsHitSchema).optional(),
  images: z.array(SearchImageHitSchema).optional(),
});

export function createSearchTool(options: CreateSearchToolsOptions) {
  const defaultLimit = options.defaultLimit ?? 5;
  const defaultSources: SearchSource[] = options.defaultSources ?? ["web"];

  return tool({
    description: SEARCH_DESCRIPTION,
    inputSchema: z.object({
      query: z.string().min(1).describe("Search query"),
      limit: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Max results per source"),
      sources: z
        .array(SearchSourceSchema)
        .optional()
        .describe('Channels to search (default `["web"]`)'),
      includeDomains: z
        .array(z.string())
        .optional()
        .describe("Only include results from these domains"),
      excludeDomains: z
        .array(z.string())
        .optional()
        .describe("Exclude results from these domains"),
      location: z
        .string()
        .optional()
        .describe("Geographic hint for the search (e.g. `US`)"),
      timeoutMs: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Per-request timeout in milliseconds"),
    }),
    outputSchema: SearchOutputSchema,
    execute: async ({
      query,
      limit,
      sources,
      includeDomains,
      excludeDomains,
      location,
      timeoutMs,
    }) => {
      return options.adapter.search(query, {
        limit: limit ?? defaultLimit,
        sources: sources ?? defaultSources,
        includeDomains,
        excludeDomains,
        location,
        timeoutMs: timeoutMs ?? options.defaultTimeoutMs,
      });
    },
  });
}

export { SEARCH_DESCRIPTION };
