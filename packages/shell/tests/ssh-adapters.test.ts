import Dockerode from "dockerode";
import { GenericContainer, type StartedTestContainer } from "testcontainers";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { SshShell } from "../src/adapters/ssh";
import {
  expectAdapterSeparatesStdoutStderr,
  expectAdapterStreamsStdoutStderr,
  expectExecuteCommandSeparatesStdoutStderr,
  SH_DUAL_STREAM_CMD,
} from "./stream-output.helpers";

const SSH_PASSWORD = "aisdk-toolkit-shell-test";

const hasDocker = await (async () => {
  try {
    await new Dockerode().ping();
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!hasDocker)("SshShell", () => {
  let container: StartedTestContainer;
  let host: string;
  let port: number;

  beforeAll(async () => {
    container = await new GenericContainer("testcontainers/sshd:1.2.0")
      .withEnvironment({ PASSWORD: SSH_PASSWORD })
      .withExposedPorts(22)
      .start();
    host = container.getHost();
    port = container.getMappedPort(22);
  }, 120_000);

  afterAll(async () => {
    await container.stop();
  });

  test("runs a command over SSH with password auth", async () => {
    const shell = await SshShell.create({
      host,
      port,
      username: "root",
      password: SSH_PASSWORD,
    });
    try {
      const result = await shell.exec("echo from-ssh");
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("from-ssh");
    } finally {
      await shell.dispose();
    }
  });

  test("respects cwd", async () => {
    const shell = await SshShell.create({
      host,
      port,
      username: "root",
      password: SSH_PASSWORD,
    });
    try {
      await shell.exec("mkdir -p /work");
      const result = await shell.exec("pwd", { cwd: "/work" });
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("/work");
    } finally {
      await shell.dispose();
    }
  });

  test("quotes env values with shell-quote", async () => {
    const shell = await SshShell.create({
      host,
      port,
      username: "root",
      password: SSH_PASSWORD,
    });
    try {
      const result = await shell.exec("printenv QUOTE_TEST", {
        env: { QUOTE_TEST: `a'b "c` },
      });
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe(`a'b "c`);
    } finally {
      await shell.dispose();
    }
  });

  test("captures non-zero exit code", async () => {
    const shell = await SshShell.create({
      host,
      port,
      username: "root",
      password: SSH_PASSWORD,
    });
    try {
      const result = await shell.exec("sh -c 'echo oops 1>&2; exit 9'");
      expect(result.exitCode).toBe(9);
      expect(result.stderr).toContain("oops");
    } finally {
      await shell.dispose();
    }
  });

  test("keeps stdout and stderr separate", async () => {
    const shell = await SshShell.create({
      host,
      port,
      username: "root",
      password: SSH_PASSWORD,
    });
    try {
      await expectAdapterSeparatesStdoutStderr(shell, SH_DUAL_STREAM_CMD);
    } finally {
      await shell.dispose();
    }
  });

  test("streams stdout and stderr to separate writables", async () => {
    const shell = await SshShell.create({
      host,
      port,
      username: "root",
      password: SSH_PASSWORD,
    });
    try {
      await expectAdapterStreamsStdoutStderr(shell, SH_DUAL_STREAM_CMD);
    } finally {
      await shell.dispose();
    }
  });

  test("executeCommand keeps stdout and stderr separate", async () => {
    const shell = await SshShell.create({
      host,
      port,
      username: "root",
      password: SSH_PASSWORD,
    });
    try {
      await expectExecuteCommandSeparatesStdoutStderr(shell, SH_DUAL_STREAM_CMD);
    } finally {
      await shell.dispose();
    }
  });
});
