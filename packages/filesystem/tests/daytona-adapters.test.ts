import { Daytona } from "@daytonaio/sdk";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { DaytonaFileSystem } from "../src/adapters/daytona";

const hasDaytonaKey = Boolean(process.env.DAYTONA_API_KEY?.trim());

describe("DaytonaFileSystem", () => {
  let daytona: Daytona;
  let sandbox: Awaited<ReturnType<Daytona["create"]>>;
  let ready = false;

  beforeAll(async () => {
    if (!hasDaytonaKey) return;
    try {
      daytona = new Daytona();
      sandbox = await daytona.create();
      await sandbox.fs.listFiles("workspace");
      ready = true;
    } catch {
      ready = false;
    }
  }, 180_000);

  afterAll(async () => {
    if (ready) await sandbox.delete();
  }, 60_000);

  test.skipIf(!ready)("read, write, and list under sandbox root", async () => {
    const adapter = await DaytonaFileSystem.create({ sandbox, root: "workspace" });
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
