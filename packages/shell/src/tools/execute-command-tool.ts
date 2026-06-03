import { tool } from "ai";
import { z } from "zod";
import type { CreateShellToolsOptions } from "./index";

const EXECUTE_COMMAND_DESCRIPTION =
  "Run a shell command and return exit code, stdout, and stderr. Use for builds, scripts, git, package managers, and other CLI tasks.";

const MAX_TOOL_OUTPUT_CHARS = 32_000;

export function createExecuteCommandTool(options: CreateShellToolsOptions) {
  return tool({
    description: EXECUTE_COMMAND_DESCRIPTION,
    inputSchema: z.object({
      command: z
        .string()
        .min(1)
        .describe("Shell command string (interpreted by the system shell)"),
      cwd: z
        .string()
        .optional()
        .describe("Optional working directory for this command only"),
      timeoutMs: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Optional timeout in milliseconds"),
    }),
    execute: async ({ command, cwd, timeoutMs }) => {
      const result = await options.adapter.exec(command, { cwd, timeoutMs });
      return formatExecResult(result);
    },
  });
}

export { EXECUTE_COMMAND_DESCRIPTION };

function formatExecResult(result: {
  stdout: string;
  stderr: string;
  exitCode: number;
  signal: string | null;
}): string {
  const parts = [`Exit code: ${result.exitCode}`];
  if (result.signal) {
    parts.push(`Signal: ${result.signal}`);
  }
  parts.push("", "--- stdout ---", truncateForTool(result.stdout));
  if (result.stderr.length > 0) {
    parts.push("", "--- stderr ---", truncateForTool(result.stderr));
  }
  return truncateForTool(parts.join("\n"));
}

function truncateForTool(text: string): string {
  if (text.length <= MAX_TOOL_OUTPUT_CHARS) {
    return text;
  }
  const omitted = text.length - MAX_TOOL_OUTPUT_CHARS;
  return `${text.slice(0, MAX_TOOL_OUTPUT_CHARS)}\n\n[truncated ${omitted} characters]`;
}
