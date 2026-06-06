import { describe, expect, test, vi } from "vitest";
import {
  ALLOW_ALL_FILESYSTEM_PERMISSIONS,
  DEFAULT_FILESYSTEM_PERMISSIONS,
  createFileSystemToolkit,
  createFileSystemTools,
  filesystemPrompt,
  PermissionDeniedError,
} from "../src/index";
import { MemoryFileSystem } from "../src/adapters/memory";

const toolOpts = { toolCallId: "test", messages: [] } as const;
const allowAll = { permissions: ALLOW_ALL_FILESYSTEM_PERMISSIONS };

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

describe("readFile / writeFile / editFile / list tools", () => {
  test("round-trip writeFile, list, readFile, editFile", async () => {
    const adapter = await MemoryFileSystem.create();
    const tools = createFileSystemTools({ adapter, ...allowAll });

    const writeResult = await unwrapToolOutput(
      await tools.writeFile.execute!(
        { path: "src/hello.txt", contents: "hello world" },
        { ...toolOpts, messages: [] },
      ),
    );
    expect(writeResult).toEqual({ created: true });

    const listed = await unwrapToolOutput(
      await tools.list.execute!(
        { path: "src" },
        { ...toolOpts, messages: [] },
      ),
    );
    expect(listed.entries.length).toBeGreaterThan(0);
    expect(listed.entries.some((e) => e.path.includes("hello.txt"))).toBe(true);

    const body = await unwrapToolOutput(
      await tools.readFile.execute!(
        { path: "src/hello.txt" },
        { ...toolOpts, messages: [] },
      ),
    );
    expect(body).toEqual({ content: "hello world" });

    const editResult = await unwrapToolOutput(
      await tools.editFile.execute!(
        {
          path: "src/hello.txt",
          oldText: "world",
          newText: "there",
        },
        { ...toolOpts, messages: [] },
      ),
    );
    expect(editResult).toMatchObject({ changed: true });
    expect(editResult.diff).toContain("-hello world");
    expect(editResult.diff).toContain("+hello there");
    expect((await adapter.readFile("src/hello.txt")).toString("utf8")).toBe(
      "hello there",
    );
  });
});

describe("writeFile tool", () => {
  test("refuses overwrite unless overwrite is true", async () => {
    const adapter = await MemoryFileSystem.create({
      initialFiles: { "note.txt": "original" },
    });
    const tools = createFileSystemTools({ adapter, ...allowAll });

    await expect(
      tools.writeFile.execute!(
        { path: "note.txt", contents: "replacement" },
        { ...toolOpts, messages: [] },
      ),
    ).rejects.toThrow(/Refusing to overwrite/);

    const result = await unwrapToolOutput(
      await tools.writeFile.execute!(
        { path: "note.txt", contents: "replacement", overwrite: true },
        { ...toolOpts, messages: [] },
      ),
    );
    expect(result).toEqual({ created: false });
    expect((await adapter.readFile("note.txt")).toString("utf8")).toBe(
      "replacement",
    );
  });
});

describe("createFileSystemTools", () => {
  test("permissions deny write", async () => {
    const adapter = await MemoryFileSystem.create();
    const tools = createFileSystemTools({
      adapter,
      permissions: [
        { mode: "deny", operations: ["write"], paths: ["secret/**"] },
        { mode: "allow", operations: ["read", "write"], paths: ["**"] },
      ],
    });

    await expect(
      tools.writeFile.execute!(
        { path: "secret/x.txt", contents: "nope" },
        { ...toolOpts, messages: [] },
      ),
    ).rejects.toThrow(PermissionDeniedError);
  });
});

describe("glob tool", () => {
  test("returns matching paths", async () => {
    const adapter = await MemoryFileSystem.create({
      initialFiles: {
        "src/a.ts": "x",
        "src/b.js": "y",
      },
    });
    const tools = createFileSystemTools({ adapter, ...allowAll });
    const out = await unwrapToolOutput(
      await tools.glob.execute!(
        { pattern: "src/**/*.ts" },
        { ...toolOpts, messages: [] },
      ),
    );
    expect(out.paths).toEqual(["src/a.ts"]);
  });
});

describe("list tool permissions", () => {
  test("omits denied child paths when listing recursively", async () => {
    const adapter = await MemoryFileSystem.create({
      initialFiles: {
        "src/public.txt": "ok",
        "src/secret/hidden.txt": "nope",
      },
    });
    const tools = createFileSystemTools({
      adapter,
      permissions: [
        {
          mode: "deny",
          operations: ["read"],
          paths: ["src/secret", "src/secret/**"],
        },
        { mode: "allow", operations: ["read", "write"], paths: ["**"] },
      ],
    });
    const out = await unwrapToolOutput(
      await tools.list.execute!(
        { path: "src", recursive: true },
        { ...toolOpts, messages: [] },
      ),
    );
    expect(out.entries.some((e) => e.path.includes("public.txt"))).toBe(true);
    expect(out.entries.some((e) => e.path.includes("secret"))).toBe(false);
  });
});

describe("grep tool", () => {
  test("does not read files denied by permissions", async () => {
    const adapter = await MemoryFileSystem.create({
      initialFiles: {
        "public.txt": "visible",
        "secret/leak.txt": "hidden",
      },
    });
    const readFile = vi.spyOn(adapter, "readFile");
    const tools = createFileSystemTools({
      adapter,
      permissions: [
        { mode: "deny", operations: ["read"], paths: ["secret/**"] },
        { mode: "allow", operations: ["read", "write"], paths: ["**"] },
      ],
    });

    const out = await unwrapToolOutput(
      await tools.grep.execute!(
        { pattern: "hidden" },
        { ...toolOpts, messages: [] },
      ),
    );

    expect(out.matches).toHaveLength(0);
    const readPaths = readFile.mock.calls.map(([path]) => path);
    expect(readPaths).not.toContain("secret/leak.txt");
    readFile.mockRestore();
  });

  test("rejects unsafe regex patterns", async () => {
    const adapter = await MemoryFileSystem.create();
    const tools = createFileSystemTools({ adapter, ...allowAll });
    await expect(
      tools.grep.execute!(
        { pattern: "(a+)+$" },
        { ...toolOpts, messages: [] },
      ),
    ).rejects.toThrow(/Unsafe grep pattern/);
  });

  test("returns structured matches", async () => {
    const adapter = await MemoryFileSystem.create({
      initialFiles: { "src/a.ts": "const a = 1\nother\n" },
    });
    const tools = createFileSystemTools({ adapter, ...allowAll });
    const out = await unwrapToolOutput(
      await tools.grep.execute!(
        { pattern: "const", pathGlob: "src/**/*.ts" },
        { ...toolOpts, messages: [] },
      ),
    );
    expect(out.matches).toHaveLength(1);
    expect(out.matches[0]).toEqual({
      path: "src/a.ts",
      line: 1,
      text: "const a = 1",
    });
  });
});

describe("createFileSystemToolkit", () => {
  test("works with a ready in-memory adapter (including initialFiles)", async () => {
    const adapter = await MemoryFileSystem.create({
      initialFiles: { "a.txt": "A" },
    });
    const { tools } = createFileSystemToolkit({ adapter, ...allowAll });
    expect(
      await unwrapToolOutput(
        await tools.readFile.execute!({ path: "a.txt" }, { ...toolOpts, messages: [] }),
      ),
    ).toEqual({ content: "A" });
  });

  test("returns tools, prompt, and state", async () => {
    const adapter = await MemoryFileSystem.create();
    const kit = createFileSystemToolkit({ adapter });
    expect(kit.tools.readFile).toBeDefined();
    expect(kit.tools.writeFile).toBeDefined();
    expect(kit.tools.editFile).toBeDefined();
    expect(kit.tools.list).toBeDefined();
    expect(kit.tools.glob).toBeDefined();
    expect(kit.tools.grep).toBeDefined();
    expect(kit.prompt()).toBe(filesystemPrompt());
    expect(kit.state.adapter).toBe(adapter);
    expect(kit.state.permissions).toEqual(DEFAULT_FILESYSTEM_PERMISSIONS);
  });

  test("denies all operations by default", async () => {
    const adapter = await MemoryFileSystem.create({
      initialFiles: { "a.txt": "A" },
    });
    const { tools } = createFileSystemToolkit({ adapter });
    await expect(
      tools.readFile.execute!({ path: "a.txt" }, { ...toolOpts, messages: [] }),
    ).rejects.toThrow(PermissionDeniedError);
  });
});
