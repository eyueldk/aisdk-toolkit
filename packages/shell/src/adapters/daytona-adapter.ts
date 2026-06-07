import { Daytona, type Sandbox } from "@daytonaio/sdk";
import { posix } from "node:path";
import {
  DEFAULT_SHELL_TIMEOUT_MS,
  ShellAdapter,
  type ShellExecOptions,
  type ShellExecResult,
} from "./index";
import { mergeEnvLayers, withTimeout, writeChunk } from "../utils";

export type DaytonaShellCreateOptions = {
  /** Running Daytona sandbox (from `daytona.create()` or `daytona.get()`). */
  sandbox?: Sandbox;
  /** When `sandbox` is omitted, load by ID or name via {@link Daytona.get}. */
  sandboxId?: string;
  /** Daytona client (default: `new Daytona()` using `DAYTONA_API_KEY`). */
  daytona?: Daytona;
  /**
   * Default working directory inside the sandbox (default `workspace`).
   * Relative to the sandbox working directory (no leading `/`).
   */
  cwd?: string;
  /** Default environment variables for each command. */
  env?: Record<string, string>;
};

/**
 * Runs shell commands in a Daytona sandbox via {@link Sandbox.process.executeCommand}.
 */
export class DaytonaShell extends ShellAdapter {
  private constructor(
    private readonly sandbox: Sandbox,
    private readonly defaultCwd: string,
    private readonly defaultEnv?: Record<string, string>,
  ) {
    super();
  }

  static async create(
    options: DaytonaShellCreateOptions,
  ): Promise<DaytonaShell> {
    let sandbox = options.sandbox;
    if (!sandbox) {
      if (!options.sandboxId) {
        throw new Error("DaytonaShell.create requires sandbox or sandboxId");
      }
      const daytona = options.daytona ?? new Daytona();
      sandbox = await daytona.get(options.sandboxId);
    }
    const defaultCwd = normalizeSandboxCwd(options.cwd ?? "workspace");
    return new DaytonaShell(sandbox, defaultCwd, options.env);
  }

  exec(command: string, options?: ShellExecOptions): Promise<ShellExecResult> {
    if (options?.stdin !== undefined) {
      return Promise.reject(
        new Error("DaytonaShell does not support stdin on exec"),
      );
    }

    const cwd = resolveSandboxCwd(this.defaultCwd, options?.cwd);
    const env = mergeEnvLayers(this.defaultEnv, options?.env);
    const timeoutMs = options?.timeoutMs ?? DEFAULT_SHELL_TIMEOUT_MS;
    const timeoutSec = Math.max(1, Math.ceil(timeoutMs / 1000));

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    const run = this.sandbox.process
      .executeCommand(
        command,
        cwd,
        Object.keys(env).length > 0 ? env : undefined,
        timeoutSec,
      )
      .then((response) => {
        const stdoutText =
          response.artifacts?.stdout ?? response.result ?? "";
        writeChunk(options?.stdout, stdoutChunks, stdoutText);
        options?.stdout?.end();
        options?.stderr?.end();
        return {
          stdout: options?.stdout
            ? ""
            : Buffer.concat(stdoutChunks).toString("utf8"),
          stderr: options?.stderr
            ? ""
            : Buffer.concat(stderrChunks).toString("utf8"),
          exitCode: response.exitCode,
          signal: null,
        } satisfies ShellExecResult;
      });

    return withTimeout(run, timeoutMs);
  }
}

function normalizeSandboxCwd(cwd: string): string {
  const trimmed = cwd.trim().replace(/^\/+/, "").replace(/\/+$/, "");
  return trimmed || "workspace";
}

function resolveSandboxCwd(defaultCwd: string, cwd?: string): string {
  if (!cwd) return defaultCwd;
  const trimmed = cwd.trim();
  if (trimmed.startsWith("/")) {
    return normalizeSandboxCwd(trimmed);
  }
  const rel = resolveAdapterPath(trimmed);
  if (rel === "/") return defaultCwd;
  return posix.join(defaultCwd, rel);
}

function resolveAdapterPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return "/";
  const joined = posix.normalize(posix.join("/", trimmed));
  if (joined === "/" || joined === ".") return "/";
  return joined.startsWith("/") ? joined.slice(1) : joined;
}
