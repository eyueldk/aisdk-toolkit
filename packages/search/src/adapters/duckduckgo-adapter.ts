import {
  search,
  searchImages,
  searchNews,
  SafeSearchType,
} from "duck-duck-scrape";
import {
  SearchAdapter,
  type SearchImageHit,
  type SearchNewsHit,
  type SearchQueryOptions,
  type SearchQueryResult,
  type SearchWebHit,
} from "./index";

export type DuckDuckGoSearchCreateOptions = {
  /** DuckDuckGo locale (default `en-us`). */
  locale?: string;
  /** DuckDuckGo region token (default `wt-wt`). */
  region?: string;
  /** Market region (default `US`). */
  marketRegion?: string;
  /** Safe-search level (default {@link SafeSearchType.MODERATE}). */
  safeSearch?: SafeSearchType;
  /** Default HTTP timeout in milliseconds. */
  timeoutMs?: number;
};

/**
 * Web search via [duck-duck-scrape](https://www.npmjs.com/package/duck-duck-scrape)
 * (no API key required).
 */
export class DuckDuckGoSearch extends SearchAdapter {
  private constructor(private readonly defaults: DuckDuckGoSearchCreateOptions) {
    super();
  }

  static async create(
    options: DuckDuckGoSearchCreateOptions = {},
  ): Promise<DuckDuckGoSearch> {
    return new DuckDuckGoSearch(options);
  }

  override async search(
    query: string,
    options: SearchQueryOptions = {},
  ): Promise<SearchQueryResult> {
    const sources = options.sources ?? ["web"];
    const limit = options.limit;
    const needleOptions = needleOptionsFromTimeout(
      options.timeoutMs ?? this.defaults.timeoutMs,
    );
    const locale = this.defaults.locale ?? "en-us";
    const region = this.defaults.region ?? "wt-wt";
    const marketRegion = options.location ?? this.defaults.marketRegion ?? "US";
    const safeSearch = this.defaults.safeSearch ?? SafeSearchType.MODERATE;

    const result: SearchQueryResult = {};

    if (sources.includes("web")) {
      const web = await search(
        query,
        { locale, region, marketRegion, safeSearch },
        needleOptions,
      );
      result.web = filterAndLimit(
        web.results.map(mapWebHit),
        options,
        limit,
        (hit) => hit.url,
      );
    }

    if (sources.includes("news")) {
      const news = await searchNews(
        query,
        { locale, safeSearch },
        needleOptions,
      );
      result.news = filterAndLimit(
        news.results.map(mapNewsHit),
        options,
        limit,
        (hit) => hit.url,
      );
    }

    if (sources.includes("images")) {
      const images = await searchImages(
        query,
        { locale, safeSearch },
        needleOptions,
      );
      result.images = filterAndLimit(
        images.results.map(mapImageHit),
        options,
        limit,
        (hit) => hit.url ?? hit.imageUrl,
      );
    }

    return result;
  }
}

function mapWebHit(result: {
  url: string;
  title: string;
  rawDescription: string;
  description: string;
}): SearchWebHit {
  return {
    url: result.url,
    title: result.title,
    description: result.rawDescription || result.description,
  };
}

function mapNewsHit(result: {
  url: string;
  title: string;
  excerpt: string;
  relativeTime: string;
}): SearchNewsHit {
  return {
    url: result.url,
    title: result.title,
    snippet: result.excerpt,
    date: result.relativeTime,
  };
}

function mapImageHit(result: {
  url: string;
  title: string;
  image: string;
}): SearchImageHit {
  return {
    url: result.url,
    title: result.title,
    imageUrl: result.image,
  };
}

function filterAndLimit<T>(
  hits: T[],
  options: SearchQueryOptions,
  limit: number | undefined,
  urlFor: (hit: T) => string | undefined,
): T[] {
  const filtered = hits.filter((hit) => {
    const url = urlFor(hit);
    if (!url) return false;
    return matchesDomainFilters(url, options);
  });
  return limit === undefined ? filtered : filtered.slice(0, limit);
}

function matchesDomainFilters(
  url: string,
  options: SearchQueryOptions,
): boolean {
  const hostname = hostnameFromUrl(url);
  if (!hostname) return false;

  if (
    options.includeDomains?.length &&
    !hostnameMatchesDomains(hostname, options.includeDomains)
  ) {
    return false;
  }

  if (
    options.excludeDomains?.length &&
    hostnameMatchesDomains(hostname, options.excludeDomains)
  ) {
    return false;
  }

  return true;
}

function hostnameFromUrl(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

function hostnameMatchesDomains(hostname: string, domains: string[]): boolean {
  const host = hostname.toLowerCase();
  return domains.some((domain) => {
    const normalized = domain.toLowerCase().replace(/^www\./, "");
    return host === normalized || host.endsWith(`.${normalized}`);
  });
}

function needleOptionsFromTimeout(timeoutMs?: number) {
  if (timeoutMs === undefined) return undefined;
  return {
    open_timeout: timeoutMs,
    response_timeout: timeoutMs,
    read_timeout: timeoutMs,
  };
}
