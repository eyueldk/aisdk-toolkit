import { describe, expect, test } from "vitest";
import {
  CompositeFileSystem,
  MemoryFileSystem,
  createFileSystemTools,
} from "../src/index";

const toolOpts = { toolCallId: "test", messages: [] } as const;

describe("CompositeFileSystem", () => {
  test("routes reads and lists through mount prefixes", async () => {
    const sandbox = await MemoryFileSystem.create({
      initialFiles: { "note.txt": "sandbox" },
    });
    const host = await MemoryFileSystem.create({
      initialFiles: { "note.txt": "host" },
    });
    const composite = CompositeFileSystem.create({
      mounts: {
        "/sandbox": sandbox,
        "/host": host,
      },
    });

    const root = await composite.readDir("/");
    expect(root.map((e) => e.path).sort()).toEqual(["host", "sandbox"]);

    expect(await composite.readFile("sandbox/note.txt", { encoding: "utf8" })).toBe(
      "sandbox",
    );
    expect(await composite.readFile("host/note.txt", { encoding: "utf8" })).toBe(
      "host",
    );
  });

  test("rejects overlapping mounts", async () => {
    const adapter = await MemoryFileSystem.create();
    expect(() =>
      CompositeFileSystem.create({
        mounts: {
          project: adapter,
          "project/src": adapter,
        },
      }),
    ).toThrow(/Overlapping composite mounts/);
  });

  test("works via createFileSystemTools({ adapter })", async () => {
    const left = await MemoryFileSystem.create({
      initialFiles: { "a.txt": "A" },
    });
    const right = await MemoryFileSystem.create({
      initialFiles: { "b.txt": "B" },
    });
    const adapter = CompositeFileSystem.create({ mounts: { left, right } });
    const tools = createFileSystemTools({ adapter });

    expect(
      await tools.readFile.execute!(
        { path: "left/a.txt" },
        { ...toolOpts, messages: [] },
      ),
    ).toBe("A");
    expect(
      await tools.readFile.execute!(
        { path: "right/b.txt" },
        { ...toolOpts, messages: [] },
      ),
    ).toBe("B");
  });
});
