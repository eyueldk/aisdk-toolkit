import { prompt as shellPrompt } from "./hint";
import {
  createShellTools,
  type CreateShellToolsOptions,
} from "./tools";

export type Toolkit<TTools extends Record<string, unknown>, TState> = {
  tools: TTools;
  prompt: () => string;
  state: TState;
};

export type ShellTools = ReturnType<typeof createShellTools>;

export type ShellToolkitState = CreateShellToolsOptions;

export type ShellToolkit = Toolkit<ShellTools, ShellToolkitState>;

/**
 * Primary entry point: AI SDK `tools`, bundled `prompt()`, and `{ adapter }` on `state`.
 */
export function createShellToolkit(
  options: CreateShellToolsOptions,
): ShellToolkit {
  const tools = createShellTools(options);
  return {
    tools,
    prompt: () => shellPrompt({ defaultTimeoutMs: options.defaultTimeoutMs }),
    state: {
      adapter: options.adapter,
      defaultTimeoutMs: options.defaultTimeoutMs,
    },
  };
}
