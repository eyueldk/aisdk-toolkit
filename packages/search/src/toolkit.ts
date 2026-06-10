import { prompt as searchPrompt } from "./hint";
import {
  createSearchTools,
  type CreateSearchToolsOptions,
} from "./tools";

export type Toolkit<TTools extends Record<string, unknown>, TState> = {
  tools: TTools;
  prompt: () => string;
  state: TState;
};

export type SearchTools = ReturnType<typeof createSearchTools>;

export type SearchToolkitState = CreateSearchToolsOptions;

export type SearchToolkit = Toolkit<SearchTools, SearchToolkitState>;

/**
 * Primary entry point: AI SDK `tools`, bundled `prompt()`, and adapter config on `state`.
 */
export function createSearchToolkit(
  options: CreateSearchToolsOptions,
): SearchToolkit {
  const tools = createSearchTools(options);
  return {
    tools,
    prompt: () =>
      searchPrompt({
        defaultLimit: options.defaultLimit,
        defaultSources: options.defaultSources,
      }),
    state: options,
  };
}
