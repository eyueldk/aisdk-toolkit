import type { ExecOptions, ExecResult, ISandbox } from "@cloudflare/sandbox";
import { posix } from "node:path";
import type { Readable } from "node:stream";
import { buffer } from "node:stream/consumers";
import {
  DEFAULT_SHELL_TIMEOUT_MS,
  ShellAdapter,
  type ShellExecOptions,
  type ShellExecResult,
} from "./index";
import {
  bufferedUtf8,
  mergeEnvLayers,
  withTimeout,
  writeChunk,
} from "../utils";

export type CloudflareSandboxShellCreateOptions = {
  /** Cloudflare Sandbox instance (from `getSandbox(env.Sandbox, id)`). */
  sandbox: ISandbox;
  /** Default working directory (default `/workspace`). */
  cwd?: string;
  /** Default environment variables merged into each command. */
  env?: Record<string, string>;
};

/**
 * Runs shell commands in a [Cloudflare Sandbox](https://developers.cloudflare.com/sandbox/)
 * via {@link ISandbox.exec}.
 */
export class CloudflareSandboxShell extends ShellAdapter {
  private constructor(
    private readonly sandbox: ISandbox,
    private readonly defaultCwd: string,
    private readonly defaultEnv?: Record<string, string>,
  ) {
    super();
  }

  static async create(
    options: CloudflareSandboxShellCreateOptions,
  ): Promise<CloudflareSandboxShell> {
    const defaultCwd = normalizeSandboxCwd(options.cwd ?? "/workspace");
    return new CloudflareSandboxShell(options.sandbox, defaultCwd, options.env);
  }

  async exec(
    command: string,
    options?: ShellExecOptions,
  ): Promise<ShellExecResult> {
    const cwd = resolveSandboxCwd(this.defaultCwd, options?.cwd);
    const env = mergeEnvLayers(this.defaultEnv, options?.env);
    const timeoutMs = options?.timeoutMs ?? DEFAULT_SHELL_TIMEOUT_MS;
    const streaming = Boolean(options?.stdout ?? options?.stderr);
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    const execOptions: ExecOptions = {
      cwd,
      env,
      timeout: timeoutMs,
    };

    if (streaming) {
      execOptions.stream = true;
      execOptions.onOutput = (stream, data) => {
        if (stream === "stdout") {
          writeChunk(options?.stdout, stdoutChunks, data);
        } else {
          writeChunk(options?.stderr, stderrChunks, data);
        }
      };
    }

    const stdin = await resolveStdin(options?.stdin);
    if (stdin !== undefined) {
      Object.assign(execOptions, { stdin });
    }

    const run = this.sandbox.exec(command, execOptions).then((result) => {
      options?.stdout?.end();
      options?.stderr?.end();
      return mapExecResult(result, options, streaming, stdoutChunks, stderrChunks);
    });

    return withTimeout(run, timeoutMs);
  }
}

function mapExecResult(
  result: ExecResult,
  options: ShellExecOptions | undefined,
  streaming: boolean,
  stdoutChunks: Buffer[],
  stderrChunks: Buffer[],
): ShellExecResult {
  return {
    stdout: options?.stdout
      ? ""
      : streaming
        ? bufferedUtf8(stdoutChunks)
        : result.stdout,
    stderr: options?.stderr
      ? ""
      : streaming
        ? bufferedUtf8(stderrChunks)
        : result.stderr,
    exitCode: result.exitCode,
    signal: null,
  };
}

async function resolveStdin(
  stdin: string | Readable | undefined,
): Promise<string | undefined> {
  if (stdin === undefined) {
    return undefined;
  }
  if (typeof stdin === "string") {
    return stdin;
  }
  const data = await buffer(stdin);
  return data.toString("utf8");
}

function normalizeSandboxCwd(cwd: string): string {
  const trimmed = cwd.trim() || "/workspace";
  if (!trimmed.startsWith("/")) {
    return posix.join("/workspace", trimmed.replace(/^\/+/, ""));
  }
  const normalized = posix.normalize(trimmed);
  return normalized.replace(/\/+$/, "") || "/";
}

function resolveSandboxCwd(defaultCwd: string, cwd?: string): string {
  if (!cwd) {
    return defaultCwd;
  }
  const trimmed = cwd.trim();
  if (trimmed.startsWith("/")) {
    return normalizeSandboxCwd(trimmed);
  }
  const rel = resolveAdapterPath(trimmed);
  if (rel === "/") {
    return defaultCwd;
  }
  return posix.join(defaultCwd, rel);
}

function resolveAdapterPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return "/";
  const joined = posix.normalize(posix.join("/", trimmed));
  if (joined === "/" || joined === ".") return "/";
  return joined.startsWith("/") ? joined.slice(1) : joined;
}
