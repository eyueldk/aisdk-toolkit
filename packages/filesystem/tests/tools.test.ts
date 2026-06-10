import { describe, expect, test, vi } from "vitest";
import {
  DEFAULT_FILESYSTEM_PERMISSIONS,
  createFileSystemToolkit,
  createFileSystemTools,
  filesystemPrompt,
  PermissionDeniedError,
} from "../src/index";
import { MemoryFileSystem } from "../src/adapters/memory-adapter";
import { createGlobTool } from "../src/tools/glob-tool";

const toolOpts = { toolCallId: "test", messages: [] } as const;
const allowAll = {
  permissions: [
    { mode: "allow" as const, operations: ["read" as const, "write" as const], paths: ["**"] },
  ],
};
const classicTools = { editMode: "tools" as const };

type GlobOutput = {
  entries: Array<{ type: "file" | "dir"; path: string }>;
};

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

async function unwrapToolStream<T>(output: T | AsyncIterable<T>): Promise<T[]> {
  if (
    output !== null &&
    typeof output === "object" &&
    Symbol.asyncIterator in output
  ) {
    const chunks: T[] = [];
    for await (const value of output) {
      chunks.push(value);
    }
    return chunks;
  }
  return [output];
}

type ToolsWithGlob = { glob: ReturnType<typeof createGlobTool> };

async function runGlob(
  tools: ToolsWithGlob,
  input: { pattern: string; include?: ("file" | "dir")[]; stream?: boolean },
): Promise<GlobOutput> {
  const raw = (await tools.glob.execute!(input, {
    ...toolOpts,
    messages: [],
  })) as unknown as GlobOutput | AsyncIterable<GlobOutput>;
  return unwrapToolOutput(raw);
}

async function runGlobStream(
  tools: ToolsWithGlob,
  input: { pattern: string; include?: ("file" | "dir")[]; stream?: boolean },
): Promise<GlobOutput[]> {
  const raw = (await tools.glob.execute!(input, {
    ...toolOpts,
    messages: [],
  })) as unknown as GlobOutput | AsyncIterable<GlobOutput>;
  return unwrapToolStream(raw);
}

describe("readFile / writeFile / editFile / glob tools", () => {
  test("round-trip writeFile, glob, readFile, editFile", async () => {
    const adapter = await MemoryFileSystem.create();
    const tools = createFileSystemTools({ adapter, ...allowAll, ...classicTools });

    const writeResult = await unwrapToolOutput(
      await tools.writeFile.execute!(
        { path: "src/hello.txt", contents: "hello world" },
        { ...toolOpts, messages: [] },
      ),
    );
    expect(writeResult).toEqual({ created: true });

    const listed = await runGlob(tools, {
      pattern: "src/*",
      include: ["file"],
    });
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
    const tools = createFileSystemTools({ adapter, ...allowAll, ...classicTools });

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
      ...classicTools,
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
  test("returns matching file entries", async () => {
    const adapter = await MemoryFileSystem.create({
      initialFiles: {
        "src/a.ts": "x",
        "src/b.js": "y",
      },
    });
    const tools = createFileSystemTools({ adapter, ...allowAll });
    const out = await runGlob(tools, {
      pattern: "src/**/*.ts",
      include: ["file"],
    });
    expect(out.entries).toEqual([{ type: "file", path: "src/a.ts" }]);
  });

  test("include dirs and files", async () => {
    const adapter = await MemoryFileSystem.create({
      initialFiles: { "src/app.ts": "x" },
    });
    const tools = createFileSystemTools({ adapter, ...allowAll });
    const out = await runGlob(tools, {
      pattern: "**",
      include: ["file", "dir"],
    });
    expect(out.entries.some((e) => e.type === "dir" && e.path === "src")).toBe(
      true,
    );
    expect(out.entries.some((e) => e.path === "src/app.ts")).toBe(true);
  });

  test("streams entry batches", async () => {
    const adapter = await MemoryFileSystem.create({
      initialFiles: {
        "a.txt": "1",
        "b.txt": "2",
        "c.txt": "3",
      },
    });
    const tools = createFileSystemTools({ adapter, ...allowAll });
    const chunks = await runGlobStream(tools, {
      pattern: "**/*.txt",
      include: ["file"],
      stream: true,
    });
    const entries = chunks.flatMap((chunk) => chunk.entries);
    expect(entries).toHaveLength(3);
  });
});

describe("glob tool permissions", () => {
  test("lists all paths even when file content read is denied", async () => {
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
    const out = await runGlob(tools, {
      pattern: "src/**",
      include: ["file", "dir"],
    });
    expect(out.entries.some((e) => e.path.includes("public.txt"))).toBe(true);
    expect(out.entries.some((e) => e.path.includes("secret"))).toBe(true);
  });

  test("works under default deny-all permissions", async () => {
    const adapter = await MemoryFileSystem.create({
      initialFiles: { "note.txt": "secret" },
    });
    const { tools } = createFileSystemToolkit({ adapter });
    const out = await runGlob(tools, { pattern: "*", include: ["file"] });
    expect(out.entries.some((e) => e.path.includes("note.txt"))).toBe(true);
  });
});

describe("remove tool", () => {
  test("removes a file", async () => {
    const adapter = await MemoryFileSystem.create({
      initialFiles: { "note.txt": "bye" },
    });
    const tools = createFileSystemTools({ adapter, ...allowAll, ...classicTools });
    await unwrapToolOutput(
      await tools.remove.execute!(
        { path: "note.txt" },
        { ...toolOpts, messages: [] },
      ),
    );
    await expect(adapter.readFile("note.txt")).rejects.toThrow();
  });

  test("refuses directory without recursive", async () => {
    const adapter = await MemoryFileSystem.create({
      initialFiles: { "src/app.ts": "x" },
    });
    const tools = createFileSystemTools({ adapter, ...allowAll, ...classicTools });
    await expect(
      tools.remove.execute!(
        { path: "src" },
        { ...toolOpts, messages: [] },
      ),
    ).rejects.toThrow(/recursive: true/);
  });

  test("removes directory when recursive", async () => {
    const adapter = await MemoryFileSystem.create({
      initialFiles: { "src/app.ts": "x" },
    });
    const tools = createFileSystemTools({ adapter, ...allowAll, ...classicTools });
    await unwrapToolOutput(
      await tools.remove.execute!(
        { path: "src", recursive: true },
        { ...toolOpts, messages: [] },
      ),
    );
    const out = await runGlob(tools, {
      pattern: "src/**",
      include: ["file", "dir"],
    });
    expect(out.entries).toHaveLength(0);
  });
});

describe("move tool", () => {
  test("move renames a file", async () => {
    const adapter = await MemoryFileSystem.create({
      initialFiles: { "old.txt": "payload" },
    });
    const tools = createFileSystemTools({ adapter, ...allowAll, ...classicTools });
    await unwrapToolOutput(
      await tools.move.execute!(
        { from: "old.txt", to: "new.txt" },
        { ...toolOpts, messages: [] },
      ),
    );
    expect((await adapter.readFile("new.txt")).toString("utf8")).toBe("payload");
    await expect(adapter.readFile("old.txt")).rejects.toThrow();
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
      ...classicTools,
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
    const tools = createFileSystemTools({ adapter, ...allowAll, ...classicTools });
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
    const tools = createFileSystemTools({ adapter, ...allowAll, ...classicTools });
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
    const { tools } = createFileSystemToolkit({ adapter, ...allowAll, ...classicTools });
    expect(
      await unwrapToolOutput(
        await tools.readFile.execute!({ path: "a.txt" }, { ...toolOpts, messages: [] }),
      ),
    ).toEqual({ content: "A" });
  });

  test("returns applyPatch tools by default", async () => {
    const adapter = await MemoryFileSystem.create();
    const kit = createFileSystemToolkit({ adapter });
    expect(kit.tools.readFile).toBeDefined();
    expect("applyPatch" in kit.tools && kit.tools.applyPatch).toBeTruthy();
    expect(kit.tools.glob).toBeDefined();
    expect(kit.tools.grep).toBeDefined();
    expect(kit.state.editMode).toBe("applyPatch");
    expect(kit.prompt()).toContain("applyPatch");
    expect(kit.prompt()).toContain("*** Begin Patch");
    expect(kit.prompt()).toEqual(
      filesystemPrompt({ permissions: DEFAULT_FILESYSTEM_PERMISSIONS }),
    );
    expect(kit.prompt()).toContain('"mode": "deny"');
    expect(kit.prompt()).toContain('"**"');
    expect(kit.state.adapter).toBe(adapter);
    expect(kit.state.permissions).toEqual(DEFAULT_FILESYSTEM_PERMISSIONS);
  });

  test("returns classic edit tools when editMode is tools", async () => {
    const adapter = await MemoryFileSystem.create();
    const kit = createFileSystemToolkit({ adapter, ...classicTools });
    expect("writeFile" in kit.tools && kit.tools.writeFile).toBeTruthy();
    expect("editFile" in kit.tools && kit.tools.editFile).toBeTruthy();
    expect("remove" in kit.tools && kit.tools.remove).toBeTruthy();
    expect("move" in kit.tools && kit.tools.move).toBeTruthy();
    expect(kit.state.editMode).toBe("tools");
    expect(kit.prompt()).toContain("writeFile");
    expect(kit.prompt()).not.toContain("*** Begin Patch");
  });

  test("prompt includes configured permissions as JSON", async () => {
    const adapter = await MemoryFileSystem.create();
    const kit = createFileSystemToolkit({
      adapter,
      permissions: [
        { mode: "allow", operations: ["read"], paths: ["src/**"] },
        { mode: "deny", operations: ["write"], paths: ["src/secret/**"] },
      ],
    });
    expect(kit.prompt()).toContain('"mode": "allow"');
    expect(kit.prompt()).toContain('"src/**"');
    expect(kit.prompt()).toContain('"src/secret/**"');
    expect(kit.prompt()).toContain("Configured permissions");
  });

  test("prompt documents glob discovery", () => {
    const text = filesystemPrompt({ editMode: "tools" });
    expect(text).toContain("glob");
    expect(text).toContain("include");
    expect(text).not.toContain("Filesystem overview");
  });

  test("applyPatch tool applies opencode patch", async () => {
    const adapter = await MemoryFileSystem.create({
      initialFiles: {
        "src/app.py": 'def greet():\nprint("Hi")\n',
        "obsolete.txt": "old",
      },
    });
    const tools = createFileSystemTools({ adapter, ...allowAll, editMode: "applyPatch" });
    const patch = `*** Begin Patch
*** Add File: hello.txt
+Hello world
*** Update File: src/app.py
*** Move to: src/main.py
@@ def greet():
-print("Hi")
+print("Hello, world!")
*** Delete File: obsolete.txt
*** End Patch`;

    if (!("applyPatch" in tools)) {
      throw new Error("expected applyPatch tool");
    }
    const out = await unwrapToolOutput(
      await tools.applyPatch.execute!({ patch }, { ...toolOpts, messages: [] }),
    );
    expect(out.applied).toEqual([
      { action: "add", path: "hello.txt" },
      { action: "move", path: "src/app.py", moveTo: "src/main.py" },
      { action: "delete", path: "obsolete.txt" },
    ]);
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
