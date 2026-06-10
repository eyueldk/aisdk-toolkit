import Firecrawl from "@mendable/firecrawl-js";
import {
  SearchAdapter,
  type SearchImageHit,
  type SearchNewsHit,
  type SearchQueryOptions,
  type SearchQueryResult,
  type SearchWebHit,
} from "./index";

export type FirecrawlSearchCreateOptions = {
  /** Falls back to `FIRECRAWL_API_KEY`. */
  apiKey?: string;
  /** Falls back to `FIRECRAWL_API_URL` or the Firecrawl default. */
  apiUrl?: string;
  /** Default per-request timeout in milliseconds. */
  timeoutMs?: number;
};

/**
 * Web search via the official [Firecrawl](https://firecrawl.dev) JS SDK.
 */
export class FirecrawlSearch extends SearchAdapter {
  private constructor(
    private readonly client: Firecrawl,
    private readonly defaultTimeoutMs?: number,
  ) {
    super();
  }

  static async create(
    options: FirecrawlSearchCreateOptions = {},
  ): Promise<FirecrawlSearch> {
    const apiKey = options.apiKey ?? process.env.FIRECRAWL_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        "FirecrawlSearch.create requires apiKey or FIRECRAWL_API_KEY",
      );
    }

    const apiUrl = options.apiUrl ?? process.env.FIRECRAWL_API_URL?.trim();
    const client = new Firecrawl({
      apiKey,
      apiUrl: apiUrl || undefined,
      timeoutMs: options.timeoutMs,
    });

    return new FirecrawlSearch(client, options.timeoutMs);
  }

  override async search(
    query: string,
    options: SearchQueryOptions = {},
  ): Promise<SearchQueryResult> {
    const data = await this.client.search(query, {
      limit: options.limit,
      sources: options.sources,
      includeDomains: options.includeDomains,
      excludeDomains: options.excludeDomains,
      location: options.location,
      timeout: options.timeoutMs ?? this.defaultTimeoutMs,
    });

    return {
      web: data.web?.map(normalizeWebHit),
      news: data.news?.map(normalizeNewsHit),
      images: data.images?.map(normalizeImageHit),
    };
  }
}

function normalizeWebHit(entry: unknown): SearchWebHit {
  if (isPlainWebHit(entry)) {
    return {
      url: entry.url,
      title: entry.title,
      description: entry.description,
    };
  }

  if (!isScrapedDocument(entry)) {
    throw new Error("Unexpected Firecrawl web search result shape");
  }

  return {
    url: documentUrl(entry),
    title: readString(entry.metadata?.title),
    description:
      readString(entry.metadata?.description) ?? readString(entry.summary),
  };
}

function normalizeNewsHit(entry: unknown): SearchNewsHit {
  if (isPlainNewsHit(entry)) {
    return {
      url: entry.url,
      title: entry.title,
      snippet: entry.snippet,
      date: entry.date,
    };
  }

  if (!isScrapedDocument(entry)) {
    throw new Error("Unexpected Firecrawl news search result shape");
  }

  return {
    url: documentUrl(entry),
    title: readString(entry.metadata?.title),
    snippet:
      readString(entry.metadata?.description) ?? readString(entry.summary),
    date: readString(entry.metadata?.publishedTime),
  };
}

function normalizeImageHit(entry: unknown): SearchImageHit {
  if (isPlainImageHit(entry)) {
    return {
      url: entry.url,
      title: entry.title,
      imageUrl: entry.imageUrl,
    };
  }

  if (!isScrapedDocument(entry)) {
    throw new Error("Unexpected Firecrawl image search result shape");
  }

  const imageUrl = entry.images?.[0];
  return {
    url: documentUrl(entry),
    title: readString(entry.metadata?.title),
    imageUrl: typeof imageUrl === "string" ? imageUrl : undefined,
  };
}

function isPlainWebHit(value: unknown): value is {
  url: string;
  title?: string;
  description?: string;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "url" in value &&
    typeof value.url === "string" &&
    !("metadata" in value)
  );
}

function isPlainNewsHit(value: unknown): value is {
  url?: string;
  title?: string;
  snippet?: string;
  date?: string;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    !("metadata" in value) &&
    ("snippet" in value || "date" in value || "title" in value)
  );
}

function isPlainImageHit(value: unknown): value is {
  url?: string;
  title?: string;
  imageUrl?: string;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "imageUrl" in value &&
    !("metadata" in value)
  );
}

function isScrapedDocument(value: unknown): value is {
  metadata?: {
    title?: string;
    description?: string;
    url?: string;
    sourceURL?: string;
    publishedTime?: string;
  };
  summary?: string;
  images?: string[];
} {
  return typeof value === "object" && value !== null && "metadata" in value;
}

function documentUrl(entry: {
  metadata?: { url?: string; sourceURL?: string };
}): string {
  return (
    readString(entry.metadata?.sourceURL) ??
    readString(entry.metadata?.url) ??
    ""
  );
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
