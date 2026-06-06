import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { LocalShell } from "../src/adapters/local";
import {
  shellPrompt,
  ShellAdapter,
  createShellToolkit,
  type ShellExecOptions,
  type ShellExecResult,
} from "../src/index";
import {
  collectExecuteCommandOutput,
  expectExecuteCommandSeparatesStdoutStderr,
  localDualStreamCommand,
} from "./stream-output.helpers";

const toolOpts = { toolCallId: "test", messages: [] } as const;
const hangCommand = 'node -e "setTimeout(() => {}, 60_000)"';

class MockStdoutShell extends ShellAdapter {
  exec(_command: string, options?: ShellExecOptions): Promise<ShellExecResult> {
    const stdoutText = "hello\n";
    if (options?.stdout) {
      options.stdout.write(stdoutText);
      options.stdout.end();
      options.stderr?.end();
      return Promise.resolve({
        stdout: "",
        stderr: "",
        exitCode: 0,
        signal: null,
      });
    }
    return Promise.resolve({
      stdout: stdoutText,
      stderr: "",
      exitCode: 0,
      signal: null,
    });
  }
}

describe("createShellToolkit", () => {
  test("returns tools, prompt, and state", async () => {
    const adapter = await LocalShell.create();
    const kit = createShellToolkit({ adapter });
    expect(kit.tools.executeCommand).toBeDefined();
    expect(kit.prompt()).toBe(shellPrompt());
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
    expect(chunks.at(-2)).toEqual(exit);
    expect(chunks.at(-1)).toMatchObject({ kind: "stdout" });
  });

  test("executeCommand ends with consolidated stdout for the model", async () => {
    const { executeCommand } = createShellToolkit({
      adapter: new MockStdoutShell(),
    }).tools;
    const chunks = await collectExecuteCommandOutput(
      await executeCommand.execute!(
        { command: "ignored" },
        { ...toolOpts, messages: [] },
      ),
    );

    const lastChunk = chunks.at(-1);
    expect(lastChunk).toEqual({
      kind: "stdout",
      text: "hello\n\n[exit 0]",
    });
    expect(
      executeCommand.toModelOutput?.({
        toolCallId: "test",
        input: { command: "ignored" },
        output: lastChunk!,
      }),
    ).toEqual({ type: "text", value: "hello\n\n[exit 0]" });
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

  test("executeCommand toModelOutput uses consolidated final stdout chunk", async () => {
    const adapter = await LocalShell.create();
    const { executeCommand } = createShellToolkit({ adapter }).tools;
    const command = localDualStreamCommand();
    const chunks = await collectExecuteCommandOutput(
      await executeCommand.execute!(
        { command },
        { ...toolOpts, messages: [] },
      ),
    );

    const lastChunk = chunks.at(-1);
    expect(lastChunk?.kind).toBe("stdout");

    const modelText = await Promise.resolve(
      executeCommand.toModelOutput?.({
        toolCallId: "test",
        input: { command },
        output: lastChunk!,
      }),
    );

    expect(modelText).toEqual({
      type: "text",
      value: expect.stringContaining("stdout-msg"),
    });
    expect(modelText?.type === "text" ? modelText.value : "").toContain(
      "[stderr] stderr-msg",
    );
    expect(modelText?.type === "text" ? modelText.value : "").toMatch(
      /\[exit 0\]/,
    );
  });

  test("executeCommand rejects when command exceeds timeoutMs", async () => {
    const adapter = await LocalShell.create();
    const { executeCommand } = createShellToolkit({ adapter }).tools;
    await expect(
      collectExecuteCommandOutput(
        await executeCommand.execute!(
          { command: hangCommand, timeoutMs: 500 },
          { ...toolOpts, messages: [] },
        ),
      ),
    ).rejects.toThrow(/timed out after 500ms/i);
  });

  test("executeCommand uses toolkit defaultTimeoutMs", async () => {
    const adapter = await LocalShell.create();
    const { executeCommand } = createShellToolkit({
      adapter,
      defaultTimeoutMs: 400,
    }).tools;
    await expect(
      collectExecuteCommandOutput(
        await executeCommand.execute!(
          { command: hangCommand },
          { ...toolOpts, messages: [] },
        ),
      ),
    ).rejects.toThrow(/timed out after 400ms/i);
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
