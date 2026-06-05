import { quote } from "shell-quote";
import { Client, type ClientChannel, type ConnectConfig } from "ssh2";
import {
  DEFAULT_SHELL_TIMEOUT_MS,
  ShellAdapter,
  type ShellExecOptions,
  type ShellExecResult,
} from "./index";
import {
  attachStdin,
  bufferedUtf8,
  mergeEnvLayers,
  toBuffer,
  withTimeout,
  writeChunk,
} from "../utils";

export type SshShellCreateOptions = {
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string | Buffer;
  passphrase?: string;
  /** Default working directory (prepended with `cd` before each command). */
  cwd?: string;
  /** Default environment variables exported before each command. */
  env?: Record<string, string>;
  /** Passed to ssh2 `readyTimeout` (default 20_000). */
  readyTimeout?: number;
  /** Extra ssh2 connect options (agent, sock, etc.). */
  connect?: Omit<
    ConnectConfig,
    "host" | "port" | "username" | "password" | "privateKey" | "passphrase"
  >;
};

/**
 * Runs commands on a remote host over SSH.
 * Call {@link dispose} when finished to close the connection.
 */
export class SshShell extends ShellAdapter {
  private constructor(
    private readonly client: Client,
    private readonly defaultCwd?: string,
    private readonly defaultEnv?: Record<string, string>,
  ) {
    super();
  }

  static async create(options: SshShellCreateOptions): Promise<SshShell> {
    const client = new Client();
    const config: ConnectConfig = {
      host: options.host,
      port: options.port ?? 22,
      username: options.username,
      password: options.password,
      privateKey: options.privateKey,
      passphrase: options.passphrase,
      readyTimeout: options.readyTimeout ?? 20_000,
      ...options.connect,
    };

    await new Promise<void>((resolve, reject) => {
      client
        .once("ready", () => resolve())
        .once("error", reject)
        .connect(config);
    });

    return new SshShell(client, options.cwd, options.env);
  }

  exec(command: string, options?: ShellExecOptions): Promise<ShellExecResult> {
    const cwd = options?.cwd ?? this.defaultCwd;
    const env = mergeEnvLayers(this.defaultEnv, options?.env);
    const remoteCommand = buildRemoteCommand(command, cwd, env);
    const timeoutMs = options?.timeoutMs ?? DEFAULT_SHELL_TIMEOUT_MS;

    let stream: ClientChannel | undefined;
    const run = execOnClient(this.client, remoteCommand, options, (s) => {
      stream = s;
    });

    return withTimeout(run, timeoutMs, () => {
      stream?.close();
    });
  }

  override async dispose(): Promise<void> {
    this.client.end();
  }
}

function execOnClient(
  client: Client,
  command: string,
  options: ShellExecOptions | undefined,
  onStream: (stream: ClientChannel) => void,
): Promise<ShellExecResult> {
  return new Promise((resolve, reject) => {
    client.exec(command, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }

      onStream(stream);

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let settled = false;

      stream.on("data", (chunk: Buffer | string) => {
        writeChunk(options?.stdout, stdoutChunks, chunk);
      });
      stream.stderr.on("data", (chunk: Buffer | string) => {
        writeChunk(options?.stderr, stderrChunks, chunk);
      });
      stream.on("error", (streamErr: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        reject(streamErr);
      });
      stream.on("close", (code: number | null, signal: string | null) => {
        if (settled) {
          return;
        }
        settled = true;
        options?.stdout?.end();
        options?.stderr?.end();
        resolve({
          stdout: options?.stdout ? "" : bufferedUtf8(stdoutChunks),
          stderr: options?.stderr ? "" : bufferedUtf8(stderrChunks),
          exitCode: code ?? 1,
          signal,
        });
      });

      if (options?.stdin !== undefined) {
        if (typeof options.stdin === "string") {
          stream.write(options.stdin);
          stream.end();
        } else {
          options.stdin.on("data", (chunk) => {
            stream.write(toBuffer(chunk));
          });
          options.stdin.on("end", () => stream.end());
          options.stdin.on("error", () => stream.destroy());
        }
      } else {
        stream.end();
      }
    });
  });
}

function buildRemoteCommand(
  command: string,
  cwd: string | undefined,
  env: Record<string, string>,
): string {
  const parts: string[] = [];
  if (Object.keys(env).length > 0) {
    for (const [key, value] of Object.entries(env)) {
      parts.push(`export ${key}=${quote([value])}`);
    }
  }
  if (cwd) {
    parts.push(`cd ${quote([cwd])}`);
  }
  parts.push(command);
  return parts.join(" && ");
}
