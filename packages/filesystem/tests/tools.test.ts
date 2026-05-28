import { describe, expect, test, vi } from "vitest";
import {
  FILE_SYSTEM_HINT,
  MemoryFileSystem,
  createFileSystemToolkit,
  createFileSystemTools,
  PermissionDeniedError,
} from "../src/index";

const toolOpts = { toolCallId: "test", messages: [] } as const;

describe("read / write / edit / list tools", () => {
  test("round-trip write, list, read, edit", async () => {
    const adapter = await MemoryFileSystem.create();
    const tools = createFileSystemTools({ adapter });

    await tools.write.execute!(
      { path: "src/hello.txt", contents: "hello world" },
      { ...toolOpts, messages: [] },
    );

    const listed = await tools.list.execute!(
      { path: "src" },
      { ...toolOpts, messages: [] },
    );
    expect(String(listed)).toContain("hello.txt");

    const body = await tools.read.execute!(
      { path: "src/hello.txt" },
      { ...toolOpts, messages: [] },
    );
    expect(body).toBe("hello world");

    await tools.edit.execute!(
      {
        path: "src/hello.txt",
        oldText: "world",
        newText: "there",
      },
      { ...toolOpts, messages: [] },
    );
    expect((await adapter.readFile("src/hello.txt")).toString("utf8")).toBe("hello there");
  });
});

describe("createFileSystemTools", () => {
  test("permissions deny write", async () => {
    const adapter = await MemoryFileSystem.create();
    const tools = createFileSystemTools({
      adapter,
      permissions: [
        { mode: "deny", operations: ["write"], paths: ["secret/**"] },
      ],
    });

    await expect(
      tools.write.execute!(
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
    const tools = createFileSystemTools({ adapter });
    const out = await tools.glob.execute!(
      { pattern: "src/**/*.ts" },
      { ...toolOpts, messages: [] },
    );
    expect(String(out)).toContain("src/a.ts");
    expect(String(out)).not.toContain("b.js");
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
      ],
    });
    const out = await tools.list.execute!(
      { path: "src", recursive: true },
      { ...toolOpts, messages: [] },
    );
    expect(String(out)).toContain("public.txt");
    expect(String(out)).not.toContain("secret");
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
      ],
    });

    await tools.grep.execute!(
      { pattern: "hidden" },
      { ...toolOpts, messages: [] },
    );

    const readPaths = readFile.mock.calls.map(([path]) => path);
    expect(readPaths).not.toContain("secret/leak.txt");
    readFile.mockRestore();
  });

  test("rejects unsafe regex patterns", async () => {
    const adapter = await MemoryFileSystem.create();
    const tools = createFileSystemTools({ adapter });
    await expect(
      tools.grep.execute!(
        { pattern: "(a+)+$" },
        { ...toolOpts, messages: [] },
      ),
    ).rejects.toThrow(/Unsafe grep pattern/);
  });

  test("returns path:line for matches", async () => {
    const adapter = await MemoryFileSystem.create({
      initialFiles: { "src/a.ts": "const a = 1\nother\n" },
    });
    const tools = createFileSystemTools({ adapter });
    const out = await tools.grep.execute!(
      { pattern: "const", pathGlob: "src/**/*.ts" },
      { ...toolOpts, messages: [] },
    );
    expect(String(out)).toContain("src/a.ts:1:");
  });
});

describe("createFileSystemToolkit", () => {
  test("works with a ready in-memory adapter (including initialFiles)", async () => {
    const adapter = await MemoryFileSystem.create({
      initialFiles: { "a.txt": "A" },
    });
    const { tools } = createFileSystemToolkit({ adapter });
    expect(await tools.read.execute!({ path: "a.txt" }, { ...toolOpts, messages: [] })).toBe(
      "A",
    );
  });

  test("returns tools, hint, and state", async () => {
    const adapter = await MemoryFileSystem.create();
    const kit = createFileSystemToolkit({ adapter });
    expect(kit.tools.read).toBeDefined();
    expect(kit.tools.write).toBeDefined();
    expect(kit.tools.edit).toBeDefined();
    expect(kit.tools.list).toBeDefined();
    expect(kit.tools.glob).toBeDefined();
    expect(kit.tools.grep).toBeDefined();
    expect(kit.hint).toBe(FILE_SYSTEM_HINT);
    expect(kit.state.adapter).toBe(adapter);
    expect(kit.state.permissions).toBeUndefined();
  });
});
