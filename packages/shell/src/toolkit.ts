import { SHELL_HINT } from "./hint";
import {
  createShellTools,
  type CreateShellToolsOptions,
} from "./tools";

export type Toolkit<TTools extends Record<string, unknown>, TState> = {
  tools: TTools;
  hint: string;
  state: TState;
};

export type ShellTools = ReturnType<typeof createShellTools>;

export type ShellToolkitState = CreateShellToolsOptions;

export type ShellToolkit = Toolkit<ShellTools, ShellToolkitState>;

/**
 * Primary entry point: AI SDK `tools`, bundled `hint`, and `{ adapter }` on `state`.
 */
export function createShellToolkit(
  options: CreateShellToolsOptions,
): ShellToolkit {
  const tools = createShellTools(options);
  return {
    tools,
    hint: SHELL_HINT,
    state: {
      adapter: options.adapter,
      defaultTimeoutMs: options.defaultTimeoutMs,
    },
  };
}
