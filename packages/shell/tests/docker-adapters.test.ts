import type { Container } from "dockerode";
import Dockerode from "dockerode";
import { GenericContainer, type StartedTestContainer } from "testcontainers";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { DockerShell } from "../src/index";
import {
  expectAdapterSeparatesStdoutStderr,
  expectAdapterStreamsStdoutStderr,
  expectExecuteCommandSeparatesStdoutStderr,
  SH_DUAL_STREAM_CMD,
} from "./stream-output.helpers";

const hasDocker = await (async () => {
  try {
    await new Dockerode().ping();
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!hasDocker)("DockerShell", () => {
  let started: StartedTestContainer;
  let container: Container;

  beforeAll(async () => {
    const docker = new Dockerode();
    started = await new GenericContainer("alpine")
      .withCommand([
        "/bin/sh",
        "-c",
        "mkdir -p /work && exec sleep infinity",
      ])
      .start();
    container = docker.getContainer(started.getId());
  }, 120_000);

  afterAll(async () => {
    await started.stop();
  });

  test("runs a command in the container", async () => {
    const shell = await DockerShell.create({ container, cwd: "/" });
    const result = await shell.exec("echo from-docker");
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("from-docker");
  });

  test("keeps stdout and stderr separate", async () => {
    const shell = await DockerShell.create({ container, cwd: "/" });
    await expectAdapterSeparatesStdoutStderr(shell, SH_DUAL_STREAM_CMD);
  });

  test("streams stdout and stderr to separate writables", async () => {
    const shell = await DockerShell.create({ container, cwd: "/" });
    await expectAdapterStreamsStdoutStderr(shell, SH_DUAL_STREAM_CMD);
  });

  test("executeCommand keeps stdout and stderr separate", async () => {
    const shell = await DockerShell.create({ container, cwd: "/" });
    await expectExecuteCommandSeparatesStdoutStderr(shell, SH_DUAL_STREAM_CMD);
  });
});
