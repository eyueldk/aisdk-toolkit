import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  LocalShell,
  SHELL_HINT,
  createShellToolkit,
} from "../src/index";
import {
  collectExecuteCommandOutput,
  expectExecuteCommandSeparatesStdoutStderr,
  localDualStreamCommand,
} from "./stream-output.helpers";

const toolOpts = { toolCallId: "test", messages: [] } as const;

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

  test("executeCommand toModelOutput sends stdout as plain text", async () => {
    const { executeCommand } = createShellToolkit({
      adapter: await LocalShell.create(),
    }).tools;

    expect(
      executeCommand.toModelOutput?.({
        toolCallId: "test",
        input: { command: "echo hi" },
        output: { kind: "stdout", text: "hi\n" },
      }),
    ).toEqual({ type: "text", value: "hi\n" });
    expect(
      executeCommand.toModelOutput?.({
        toolCallId: "test",
        input: { command: "echo err >&2" },
        output: { kind: "stderr", text: "err\n" },
      }),
    ).toEqual({ type: "text", value: "[stderr] err\n" });
  });

  test("executeCommand captures stderr without shell redirect", async () => {
    const adapter = await LocalShell.create();
    const { executeCommand } = createShellToolkit({ adapter }).tools;
    const command =
      process.platform === "win32"
        ? "cmd /c \"echo err 1>&2\""
        : "echo err >&2";
    const chunks = await collectExecuteCommandOutput(
      await executeCommand.execute!(
        { command },
        { ...toolOpts, messages: [] },
      ),
    );

    expect(
      chunks.some(
        (chunk) => chunk.kind === "stderr" && chunk.text.includes("err"),
      ),
    ).toBe(true);
  });

  test("executeCommand keeps stdout and stderr separate in one run", async () => {
    const adapter = await LocalShell.create();
    await expectExecuteCommandSeparatesStdoutStderr(
      adapter,
      localDualStreamCommand(),
    );
  });

  test("executeCommand toModelOutput maps both streams from a combined run", async () => {
    const adapter = await LocalShell.create();
    const { executeCommand } = createShellToolkit({ adapter }).tools;
    const command = localDualStreamCommand();
    const chunks = await collectExecuteCommandOutput(
      await executeCommand.execute!(
        { command },
        { ...toolOpts, messages: [] },
      ),
    );

    const modelText = (
      await Promise.all(
        chunks.map((output) =>
          Promise.resolve(
            executeCommand.toModelOutput?.({
              toolCallId: "test",
              input: { command },
              output,
            }),
          ),
        ),
      )
    )
      .map((part) => (part?.type === "text" ? part.value : ""))
      .join("");

    expect(modelText).toContain("stdout-msg");
    expect(modelText).toContain("[stderr] stderr-msg");
    expect(modelText).not.toMatch(/\[stderr\].*stdout-msg/);
    expect(modelText).toMatch(/\[exit 0\]/);
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
