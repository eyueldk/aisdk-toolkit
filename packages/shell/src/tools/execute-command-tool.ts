import { tool } from "ai";
import { z } from "zod";
import type { ShellAdapter } from "../adapters";
import { DEFAULT_SHELL_TIMEOUT_MS } from "../adapters";
import {
  AsyncChunkWritable,
  mergeTaggedAsync,
  takeStreamText,
} from "../utils";
import type { CreateShellToolsOptions } from "./index";

const EXECUTE_COMMAND_DESCRIPTION =
  "Run a shell command. Captures stdout and stderr separately as streamed chunks (do not append shell redirects like 2>&1 — stderr is already returned in its own chunks). Ends with an exit chunk, then a final consolidated stdout chunk for the model. Pass cwd to set the working directory. Commands always time out (default 120s unless timeoutMs is set).";

const MAX_STREAM_CHARS = 32_000;

const ExecuteCommandOutputSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("stdout"),
    text: z.string().describe("Stdout chunk"),
  }),
  z.object({
    kind: z.literal("stderr"),
    text: z.string().describe("Stderr chunk"),
  }),
  z.object({
    kind: z.literal("exit"),
    exitCode: z.number().int().describe("Process exit code"),
    signal: z.string().nullable().describe("Termination signal, if any"),
  }),
]);

type ExecuteCommandChunk = z.infer<typeof ExecuteCommandOutputSchema>;
type StreamChunk = { tag: "stdout" | "stderr"; value: string };

type ShellOutputAccumulator = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: string | null;
};

export function createExecuteCommandTool(options: CreateShellToolsOptions) {
  const defaultTimeoutMs =
    options.defaultTimeoutMs ?? DEFAULT_SHELL_TIMEOUT_MS;

  return tool({
    description: EXECUTE_COMMAND_DESCRIPTION,
    inputSchema: z.object({
      command: z
        .string()
        .min(1)
        .describe(
          "Shell command string. Do not add 2>&1 or merge stderr — the tool captures stdout and stderr separately.",
        ),
      cwd: z
        .string()
        .optional()
        .describe(
          "Working directory to run the command in; omit to use the adapter default",
        ),
      timeoutMs: z
        .number()
        .int()
        .positive()
        .optional()
        .describe(
          `Max runtime in milliseconds (default ${defaultTimeoutMs}). Commands always time out.`,
        ),
    }),
    outputSchema: ExecuteCommandOutputSchema,
    execute: ({ command, cwd, timeoutMs }) =>
      streamExecuteCommand(options.adapter, command, {
        cwd,
        timeoutMs: timeoutMs ?? defaultTimeoutMs,
      }),
    toModelOutput: ({ output }) => formatExecuteCommandChunkForModel(output),
  });
}

export { EXECUTE_COMMAND_DESCRIPTION };

async function* streamExecuteCommand(
  adapter: ShellAdapter,
  command: string,
  execOptions: { cwd?: string; timeoutMs: number },
): AsyncGenerator<ExecuteCommandChunk> {
  const acc: ShellOutputAccumulator = {
    stdout: "",
    stderr: "",
    exitCode: null,
    signal: null,
  };
  const stdout = new AsyncChunkWritable();
  const stderr = new AsyncChunkWritable();
  const pending: StreamChunk[] = [];
  let pumpDone = false;
  let pumpError: unknown;

  const execPromise = adapter
    .exec(command, {
      cwd: execOptions.cwd,
      timeoutMs: execOptions.timeoutMs,
      stdout,
      stderr,
    })
    .catch((error) => {
      stdout.end();
      stderr.end();
      throw error;
    });

  void pumpStreamChunks(
    mergeTaggedAsync([
      { tag: "stdout", iterable: stdout.chunks() },
      { tag: "stderr", iterable: stderr.chunks() },
    ]),
    pending,
  ).then(
    () => {
      pumpDone = true;
    },
    (error) => {
      pumpError = error;
      pumpDone = true;
    },
  );

  let stdoutUsed = 0;
  let stderrUsed = 0;
  let stdoutTruncated = false;
  let stderrTruncated = false;

  while (!pumpDone || pending.length > 0) {
    if (pending.length === 0) {
      await Promise.race([waitForStreamData(pending, () => pumpDone), execPromise]);
    }

    if (pumpError) {
      throw pumpError;
    }

    while (pending.length > 0) {
      const chunk = pending.shift()!;
      if (chunk.tag === "stdout") {
        const taken = takeStreamText(chunk.value, stdoutUsed, MAX_STREAM_CHARS);
        stdoutUsed = taken.used;
        if (taken.text) {
          yield* yieldStdoutChunk(acc, taken.text);
        }
        if (
          stdoutUsed >= MAX_STREAM_CHARS &&
          chunk.value.length > taken.text.length
        ) {
          stdoutTruncated = true;
        }
        continue;
      }

      const taken = takeStreamText(chunk.value, stderrUsed, MAX_STREAM_CHARS);
      stderrUsed = taken.used;
      if (taken.text) {
        yield* yieldStderrChunk(acc, taken.text);
      }
      if (
        stderrUsed >= MAX_STREAM_CHARS &&
        chunk.value.length > taken.text.length
      ) {
        stderrTruncated = true;
      }
    }
  }

  const result = await execPromise;

  if (stdoutUsed === 0 && result.stdout.length > 0) {
    const taken = takeStreamText(result.stdout, 0, MAX_STREAM_CHARS);
    stdoutUsed = taken.used;
    if (taken.text) {
      yield* yieldStdoutChunk(acc, taken.text);
    }
    if (result.stdout.length > taken.text.length) {
      stdoutTruncated = true;
    }
  }

  if (stderrUsed === 0 && result.stderr.length > 0) {
    const taken = takeStreamText(result.stderr, 0, MAX_STREAM_CHARS);
    stderrUsed = taken.used;
    if (taken.text) {
      yield* yieldStderrChunk(acc, taken.text);
    }
    if (result.stderr.length > taken.text.length) {
      stderrTruncated = true;
    }
  }

  if (stdoutTruncated) {
    yield* yieldStderrChunk(
      acc,
      `\n[stdout truncated at ${MAX_STREAM_CHARS} characters]`,
    );
  }
  if (stderrTruncated) {
    yield* yieldStderrChunk(
      acc,
      `\n[stderr truncated at ${MAX_STREAM_CHARS} characters]`,
    );
  }

  acc.exitCode = result.exitCode;
  acc.signal = result.signal;
  yield {
    kind: "exit",
    exitCode: result.exitCode,
    signal: result.signal,
  };
  yield {
    kind: "stdout",
    text: formatShellOutputForModel(acc),
  };
}

function* yieldStdoutChunk(
  acc: ShellOutputAccumulator,
  text: string,
): Generator<ExecuteCommandChunk> {
  acc.stdout += text;
  yield { kind: "stdout", text };
}

function* yieldStderrChunk(
  acc: ShellOutputAccumulator,
  text: string,
): Generator<ExecuteCommandChunk> {
  acc.stderr += text;
  yield { kind: "stderr", text };
}

function formatShellOutputForModel(acc: ShellOutputAccumulator): string {
  let text = acc.stdout;
  if (acc.stderr.length > 0) {
    text += `[stderr] ${acc.stderr}`;
  }
  if (acc.exitCode !== null) {
    const signal = acc.signal ? ` signal=${acc.signal}` : "";
    text += `\n[exit ${acc.exitCode}${signal}]`;
  }
  return text;
}

async function pumpStreamChunks(
  stream: AsyncIterable<StreamChunk>,
  pending: StreamChunk[],
): Promise<void> {
  for await (const chunk of stream) {
    pending.push(chunk);
  }
}

async function waitForStreamData(
  pending: StreamChunk[],
  isDone: () => boolean,
): Promise<void> {
  while (pending.length === 0 && !isDone()) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  }
}

function formatExecuteCommandChunkForModel(output: ExecuteCommandChunk): {
  type: "text";
  value: string;
} {
  if (output.kind === "stdout") {
    return { type: "text", value: output.text };
  }
  if (output.kind === "stderr") {
    return { type: "text", value: `[stderr] ${output.text}` };
  }
  const signal = output.signal ? ` signal=${output.signal}` : "";
  return {
    type: "text",
    value: `\n[exit ${output.exitCode}${signal}]`,
  };
}
