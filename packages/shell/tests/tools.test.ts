import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  LocalShell,
  SHELL_HINT,
  createShellToolkit,
} from "../src/index";

const toolOpts = { toolCallId: "test", messages: [] } as const;

type ExecuteCommandChunk =
  | { kind: "stdout"; text: string }
  | { kind: "stderr"; text: string }
  | { kind: "exit"; exitCode: number; signal: string | null };

async function collectExecuteCommandOutput(
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

describe("createShellToolkit", () => {
  test("returns tools, hint, and state", async () => {
    const adapter = await LocalShell.create();
    const kit = createShellToolkit({ adapter });
    expect(kit.tools.executeCommand).toBeDefined();
    expect(kit.hint).toBe(SHELL_HINT);
    expect(kit.state.adapter).toBe(adapter);
  });

  test("executeCommand streams structured stdout and exit chunks", async () => {
    const adapter = await LocalShell.create();
    const { executeCommand } = createShellToolkit({ adapter }).tools;
    const chunks = await collectExecuteCommandOutput(
      await executeCommand.execute!(
        { command: "echo hi" },
        { ...toolOpts, messages: [] },
      ),
    );

    const stdout = chunks
      .filter((chunk) => chunk.kind === "stdout")
      .map((chunk) => chunk.text)
      .join("");
    const exit = chunks.find((chunk) => chunk.kind === "exit");

    expect(stdout).toContain("hi");
    expect(exit).toEqual({ kind: "exit", exitCode: 0, signal: null });
    expect(chunks.at(-1)).toEqual(exit);
  });

  test("executeCommand cwd selects working directory", async () => {
    const workDir = mkdtempSync(join(tmpdir(), "aisdk-shell-cwd-"));
    const adapter = await LocalShell.create();
    const { executeCommand } = createShellToolkit({ adapter }).tools;
    const chunks = await collectExecuteCommandOutput(
      await executeCommand.execute!(
        { command: "node -p \"process.cwd()\"", cwd: workDir },
        { ...toolOpts, messages: [] },
      ),
    );

    const stdout = chunks
      .filter((chunk) => chunk.kind === "stdout")
      .map((chunk) => chunk.text)
      .join("");
    expect(stdout).toContain(workDir);
  });
});
