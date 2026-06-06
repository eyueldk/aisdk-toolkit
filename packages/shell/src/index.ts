export type { ShellExecOptions, ShellExecResult } from "./adapters";
export { DEFAULT_SHELL_TIMEOUT_MS } from "./adapters";
export { ShellAdapter } from "./adapters";
export { prompt as shellPrompt, type ShellPromptOptions } from "./hint";
export {
  createShellToolkit,
  type ShellToolkit,
  type ShellToolkitState,
  type ShellTools,
  type Toolkit,
} from "./toolkit";
export {
  createShellTools,
  type CreateShellToolsOptions,
} from "./tools";
export {
  createExecuteCommandTool,
  EXECUTE_COMMAND_DESCRIPTION,
} from "./tools/execute-command-tool";
