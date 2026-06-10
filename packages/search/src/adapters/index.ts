export type SearchSource = "web" | "news" | "images";

export type SearchQueryOptions = {
  /** Max results per source (adapter default when omitted). */
  limit?: number;
  /** Result channels to request (default `["web"]`). */
  sources?: SearchSource[];
  includeDomains?: string[];
  excludeDomains?: string[];
  /** Geographic hint for the search (e.g. `US`). */
  location?: string;
  /** Per-request timeout in milliseconds. */
  timeoutMs?: number;
};

export type SearchWebHit = {
  url: string;
  title?: string;
  description?: string;
};

export type SearchNewsHit = {
  url?: string;
  title?: string;
  snippet?: string;
  date?: string;
};

export type SearchImageHit = {
  url?: string;
  title?: string;
  imageUrl?: string;
};

export type SearchQueryResult = {
  web?: SearchWebHit[];
  news?: SearchNewsHit[];
  images?: SearchImageHit[];
};

/**
 * Pluggable search backend for {@link createSearchToolkit} and {@link createSearchTools}.
 */
export abstract class SearchAdapter {
  abstract search(
    query: string,
    options?: SearchQueryOptions,
  ): Promise<SearchQueryResult>;
}
