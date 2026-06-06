import {
  DEFAULT_FETCH_TIMEOUT_MS,
  type PerformHttpFetchOptions,
} from "./fetch";
import { prompt as fetchPrompt } from "./hint";
import {
  createFetchTools,
  type CreateFetchToolsOptions,
} from "./tools";

export type Toolkit<TTools extends Record<string, unknown>, TState> = {
  tools: TTools;
  prompt: () => string;
  state: TState;
};

export type FetchTools = ReturnType<typeof createFetchTools>;

export type CreateFetchToolkitOptions = {
  fetch?: typeof globalThis.fetch;
  defaultTimeoutMs?: number;
};

export type FetchToolkitState = PerformHttpFetchOptions;

export type FetchToolkit = Toolkit<FetchTools, FetchToolkitState>;

/**
 * Primary entry point: AI SDK `tools`, bundled `prompt()`, and fetch config on `state`.
 * Uses `globalThis.fetch` by default.
 */
export function createFetchToolkit(
  options?: CreateFetchToolkitOptions,
): FetchToolkit {
  const fetchFn = options?.fetch ?? globalThis.fetch;
  if (!fetchFn) {
    throw new Error("No fetch implementation available");
  }
  const state: FetchToolkitState = {
    fetch: fetchFn,
    defaultTimeoutMs:
      options?.defaultTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS,
  };
  const tools = createFetchTools(state);
  return {
    tools,
    prompt: () => fetchPrompt({ defaultTimeoutMs: state.defaultTimeoutMs }),
    state,
  };
}
