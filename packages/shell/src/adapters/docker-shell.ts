import type { Container } from "dockerode";
import type { Duplex, Writable } from "node:stream";
import {
  DEFAULT_SHELL_TIMEOUT_MS,
  ShellAdapter,
  type ShellExecOptions,
  type ShellExecResult,
} from "./index";
import {
  CollectStream,
  mergeEnvLayers,
  toDockerEnvList,
  withTimeout,
} from "../utils";

export type DockerShellCreateOptions = {
  /** dockerode container handle for a running container. */
  container: Container;
  /** Default working directory inside the container (default `/`). */
  cwd?: string;
  /** Default environment variables for each command. */
  env?: Record<string, string>;
};

/**
 * Runs commands in a running Docker container via `sh -c`.
 */
export class DockerShell extends ShellAdapter {
  private constructor(
    private readonly container: Container,
    private readonly defaultCwd: string,
    private readonly defaultEnv?: Record<string, string>,
  ) {
    super();
  }

  static async create(
    options: DockerShellCreateOptions,
  ): Promise<DockerShell> {
    await options.container.inspect();
    const defaultCwd = normalizeContainerCwd(options.cwd ?? "/");
    return new DockerShell(options.container, defaultCwd, options.env);
  }

  exec(command: string, options?: ShellExecOptions): Promise<ShellExecResult> {
    const cwd = normalizeContainerCwd(options?.cwd ?? this.defaultCwd);
    const envList = toDockerEnvList(
      mergeEnvLayers(this.defaultEnv, options?.env),
    );
    const timeoutMs = options?.timeoutMs ?? DEFAULT_SHELL_TIMEOUT_MS;

    let stream: Duplex | undefined;
    const run = execInContainer(
      this.container,
      ["/bin/sh", "-c", command],
      {
        WorkingDir: cwd,
        Env: envList.length > 0 ? envList : undefined,
        stdout: options?.stdout,
        stderr: options?.stderr,
        onStream: (s) => {
          stream = s;
        },
      },
    );

    return withTimeout(run, timeoutMs, () => {
      stream?.destroy();
    });
  }
}

async function execInContainer(
  container: Container,
  cmd: string[],
  execOptions: {
    WorkingDir?: string;
    Env?: string[];
    stdout?: Writable;
    stderr?: Writable;
    onStream?: (stream: Duplex) => void;
  },
): Promise<ShellExecResult> {
  const exec = await container.exec({
    Cmd: cmd,
    AttachStdout: true,
    AttachStderr: true,
    AttachStdin: false,
    WorkingDir: execOptions.WorkingDir,
    Env: execOptions.Env,
  });
  const stream = await exec.start({ hijack: true, stdin: false });
  execOptions.onStream?.(stream);
  const stdoutSink = execOptions.stdout ?? new CollectStream();
  const stderrSink = execOptions.stderr ?? new CollectStream();
  container.modem.demuxStream(stream, stdoutSink, stderrSink);

  await new Promise<void>((resolve, reject) => {
    stream.on("end", () => resolve());
    stream.on("error", reject);
  });

  execOptions.stdout?.end();
  execOptions.stderr?.end();

  const inspect = await exec.inspect();
  return {
    stdout:
      stdoutSink instanceof CollectStream ? stdoutSink.text() : "",
    stderr:
      stderrSink instanceof CollectStream ? stderrSink.text() : "",
    exitCode: inspect.ExitCode ?? 1,
    signal: null,
  };
}

function normalizeContainerCwd(cwd: string): string {
  const trimmed = cwd.trim();
  if (!trimmed || trimmed === "/") {
    return "/";
  }
  return `/${trimmed.replace(/^\/+/, "").replace(/\/+$/, "")}`;
}
