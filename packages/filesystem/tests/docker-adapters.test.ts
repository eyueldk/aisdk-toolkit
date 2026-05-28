import Dockerode from "dockerode";
import { GenericContainer, type StartedTestContainer } from "testcontainers";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { DockerFileSystem } from "../src/index";

const hasDocker = await (async () => {
  try {
    await new Dockerode().ping();
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!hasDocker)("DockerFileSystem", () => {
  let docker: Dockerode;
  let container: StartedTestContainer;

  beforeAll(async () => {
    docker = new Dockerode();
    container = await new GenericContainer("alpine")
      .withCommand(["sh", "-c", "mkdir -p /work && exec sleep infinity"])
      .start();
  }, 120_000);

  afterAll(async () => {
    await container.stop();
  });

  test("read, write, and list under container root", async () => {
    const adapter = await DockerFileSystem.create({
      container: container.getId(),
      root: "/work",
      docker,
    });
    await adapter.writeFile("hello.txt", "from-adapter", {
      encoding: "utf8",
    });
    expect(await adapter.readFile("hello.txt", { encoding: "utf8" })).toBe(
      "from-adapter",
    );
    await adapter.writeFile("nested/inner.txt", "nested", {
      encoding: "utf8",
    });
    const listed = await adapter.readDir(".");
    expect(listed).toEqual(
      expect.arrayContaining([
        { path: "hello.txt", type: "file" },
        { path: "nested", type: "dir" },
      ]),
    );
    const recursive = await adapter.readDirRecursive(".");
    expect(recursive).toEqual(
      expect.arrayContaining([
        { path: "nested", type: "dir" },
        { path: "nested/inner.txt", type: "file" },
      ]),
    );
  });
});
