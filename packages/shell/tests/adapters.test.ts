import { PassThrough } from "node:stream";
import { buffer } from "node:stream/consumers";
import { beforeAll, describe, expect, test } from "vitest";
import { LocalShell } from "../src/index";
import {
  expectAdapterSeparatesStdoutStderr,
  expectAdapterStreamsStdoutStderr,
  expectExecuteCommandSeparatesStdoutStderr,
  localDualStreamCommand,
} from "./stream-output.helpers";

describe("LocalShell", () => {
  let shell: LocalShell;

  beforeAll(async () => {
    shell = await LocalShell.create();
  });

  test("runs echo on the local machine", async () => {
    const result = await shell.exec("echo hello");
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("hello");
  });

  test("respects cwd", async () => {
    const result = await shell.exec(
      process.platform === "win32" ? "cd" : "pwd",
      { cwd: process.platform === "win32" ? process.env.TEMP : "/tmp" },
    );
    expect(result.exitCode).toBe(0);
    if (process.platform !== "win32") {
      expect(result.stdout.trim()).toBe("/tmp");
    }
  });

  test("streams stdout to a writable", async () => {
    const stdout = new PassThrough();
    const stdoutDone = buffer(stdout);
    const result = await shell.exec("echo streamed", { stdout });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
    expect((await stdoutDone).toString("utf8").trim()).toBe("streamed");
  });

  test("streams stderr to a writable", async () => {
    const stderr = new PassThrough();
    const stderrDone = buffer(stderr);
    const result = await shell.exec(
      process.platform === "win32"
        ? "cmd /c \"echo err 1>&2\""
        : "sh -c 'echo err 1>&2'",
      { stderr },
    );
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect((await stderrDone).toString("utf8")).toContain("err");
  });

  test("captures stderr on failure", async () => {
    const result = await shell.exec(
      process.platform === "win32"
        ? "cmd /c \"exit 7\""
        : "sh -c 'echo err 1>&2; exit 7'",
    );
    expect(result.exitCode).toBe(7);
    if (process.platform !== "win32") {
      expect(result.stderr).toContain("err");
    }
  });

  test("keeps stdout and stderr separate", async () => {
    await expectAdapterSeparatesStdoutStderr(
      shell,
      localDualStreamCommand(),
    );
  });

  test("streams stdout and stderr to separate writables", async () => {
    await expectAdapterStreamsStdoutStderr(shell, localDualStreamCommand());
  });

  test("executeCommand keeps stdout and stderr separate", async () => {
    await expectExecuteCommandSeparatesStdoutStderr(
      shell,
      localDualStreamCommand(),
    );
  });
});
