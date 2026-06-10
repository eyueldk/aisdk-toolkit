import type { SearchAdapter, SearchSource } from "../adapters";
import { createSearchTool } from "./search-tool";

export type CreateSearchToolsOptions = {
  adapter: SearchAdapter;
  /** Default `limit` when the tool omits it. */
  defaultLimit?: number;
  /** Default `sources` when the tool omits them. */
  defaultSources?: SearchSource[];
  /** Default per-request timeout in milliseconds. */
  defaultTimeoutMs?: number;
};

/**
 * Builds search AI SDK tools for the Vercel AI SDK.
 */
export function createSearchTools(options: CreateSearchToolsOptions) {
  return {
    search: createSearchTool(options),
  } as const;
}
