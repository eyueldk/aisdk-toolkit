import { describe, expect, test } from "vitest";
import { CompositeFileSystem } from "../src/adapters/composite";
import { MemoryFileSystem } from "../src/adapters/memory";
import {
  ALLOW_ALL_FILESYSTEM_PERMISSIONS,
  createFileSystemTools,
} from "../src/index";

const toolOpts = { toolCallId: "test", messages: [] } as const;

async function unwrapToolOutput<T>(output: T | AsyncIterable<T>): Promise<T> {
  if (
    output !== null &&
    typeof output === "object" &&
    Symbol.asyncIterator in output
  ) {
    for await (const value of output) {
      return value;
    }
    throw new Error("Empty tool output stream");
  }
  return output;
}

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
    const tools = createFileSystemTools({
      adapter,
      permissions: ALLOW_ALL_FILESYSTEM_PERMISSIONS,
    });

    expect(
      await unwrapToolOutput(
        await tools.readFile.execute!(
          { path: "left/a.txt" },
          { ...toolOpts, messages: [] },
        ),
      ),
    ).toEqual({ content: "A" });
    expect(
      await unwrapToolOutput(
        await tools.readFile.execute!(
          { path: "right/b.txt" },
          { ...toolOpts, messages: [] },
        ),
      ),
    ).toEqual({ content: "B" });
  });
});
