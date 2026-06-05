import type { Readable, Writable } from "node:stream";

export const DEFAULT_SHELL_TIMEOUT_MS = 120_000;

export type ShellExecOptions = {
  /** Working directory for the command. */
  cwd?: string;
  /** Extra environment variables (merged with the adapter default environment). */
  env?: Record<string, string>;
  /** Maximum runtime in milliseconds (default {@link DEFAULT_SHELL_TIMEOUT_MS}). */
  timeoutMs?: number;
  /** Stdin payload or stream (local and SSH adapters). */
  stdin?: string | Readable;
  /** When set, process stdout is written here instead of buffered into the result. */
  stdout?: Writable;
  /** When set, process stderr is written here instead of buffered into the result. */
  stderr?: Writable;
};

export type ShellExecResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  signal: string | null;
};

/**
 * Pluggable shell backend for {@link createShellToolkit} and {@link createShellTools}.
 */
export abstract class ShellAdapter {
  abstract exec(
    command: string,
    options?: ShellExecOptions,
  ): Promise<ShellExecResult>;

  /** Release connections or other resources (no-op by default). */
  async dispose(): Promise<void> {}
}
