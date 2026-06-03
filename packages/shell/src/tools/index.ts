import type { ShellAdapter } from "../adapter";
import { createExecuteCommandTool } from "./execute-command-tool";

export type CreateShellToolsOptions = {
  adapter: ShellAdapter;
};

/**
 * Builds shell AI SDK tools (`executeCommand`) for the Vercel AI SDK.
 */
export function createShellTools(options: CreateShellToolsOptions) {
  return {
    executeCommand: createExecuteCommandTool(options),
  } as const;
}
