import { PassThrough } from "node:stream";
import { buffer } from "node:stream/consumers";
import { expect } from "vitest";
import type { ShellAdapter } from "../src/adapters";
import { createShellToolkit } from "../src/index";

export const SH_DUAL_STREAM_CMD =
  "printf 'stdout-msg\\n'; printf 'stderr-msg\\n' 1>&2";

export const NODE_DUAL_STREAM_CMD =
  "node -e \"process.stdout.write('stdout-msg\\\\n'); process.stderr.write('stderr-msg\\\\n')\"";

export function localDualStreamCommand(): string {
  return process.platform === "win32"
    ? NODE_DUAL_STREAM_CMD
    : SH_DUAL_STREAM_CMD;
}

type ExecuteCommandChunk =
  | { kind: "stdout"; text: string }
  | { kind: "stderr"; text: string }
  | { kind: "exit"; exitCode: number; signal: string | null };

const toolOpts = { toolCallId: "test", messages: [] } as const;

export async function collectExecuteCommandOutput(
  output: ExecuteCommandChunk | AsyncIterable<ExecuteCommandChunk>,
): Promise<ExecuteCommandChunk[]> {
  if (
    output !== null &&
    typeof output === "object" &&
    Symbol.asyncIterator in output
  ) {
    const chunks: ExecuteCommandChunk[] = [];
    for await (const chunk of output) {
      chunks.push(chunk);
    }
    return chunks;
  }
  return [output];
}

function joinStreamText(
  chunks: ExecuteCommandChunk[],
  kind: "stdout" | "stderr",
): string {
  return chunks
    .filter((chunk): chunk is Extract<ExecuteCommandChunk, { kind: typeof kind }> =>
      chunk.kind === kind,
    )
    .map((chunk) => chunk.text)
    .join("");
}

export async function expectAdapterSeparatesStdoutStderr(
  shell: ShellAdapter,
  command: string,
): Promise<void> {
  const result = await shell.exec(command);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain("stdout-msg");
  expect(result.stderr).toContain("stderr-msg");
  expect(result.stdout).not.toContain("stderr-msg");
  expect(result.stderr).not.toContain("stdout-msg");
}

export async function expectAdapterStreamsStdoutStderr(
  shell: ShellAdapter,
  command: string,
): Promise<void> {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const stdoutDone = buffer(stdout);
  const stderrDone = buffer(stderr);
  const result = await shell.exec(command, { stdout, stderr });
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBe("");
  expect(result.stderr).toBe("");

  const stdoutText = (await stdoutDone).toString("utf8");
  const stderrText = (await stderrDone).toString("utf8");
  expect(stdoutText).toContain("stdout-msg");
  expect(stderrText).toContain("stderr-msg");
  expect(stdoutText).not.toContain("stderr-msg");
  expect(stderrText).not.toContain("stdout-msg");
}

function streamedChunksOnly(
  chunks: ExecuteCommandChunk[],
): ExecuteCommandChunk[] {
  const last = chunks.at(-1);
  const beforeLast = chunks.at(-2);
  if (last?.kind === "stdout" && beforeLast?.kind === "exit") {
    return chunks.slice(0, -1);
  }
  return chunks;
}

export async function expectExecuteCommandSeparatesStdoutStderr(
  adapter: ShellAdapter,
  command: string,
): Promise<void> {
  const { executeCommand } = createShellToolkit({ adapter }).tools;
  const chunks = await collectExecuteCommandOutput(
    await executeCommand.execute!({ command }, { ...toolOpts, messages: [] }),
  );
  const streamed = streamedChunksOnly(chunks);

  const stdout = joinStreamText(streamed, "stdout");
  const stderr = joinStreamText(streamed, "stderr");

  expect(stdout).toContain("stdout-msg");
  expect(stderr).toContain("stderr-msg");
  expect(stdout).not.toContain("stderr-msg");
  expect(stderr).not.toContain("stdout-msg");
  expect(streamed.some((chunk) => chunk.kind === "stdout")).toBe(true);
  expect(streamed.some((chunk) => chunk.kind === "stderr")).toBe(true);
  expect(streamed.at(-1)).toMatchObject({ kind: "exit", exitCode: 0 });
  expect(chunks.at(-1)).toMatchObject({ kind: "stdout" });
}
