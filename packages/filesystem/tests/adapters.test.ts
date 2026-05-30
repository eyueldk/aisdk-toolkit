import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "pathe";
import { describe, expect, test } from "vitest";
import { LocalFileSystem, MemoryFileSystem } from "../src/index";

describe("LocalFileSystem", () => {
  test("reads and writes under root", async () => {
    const root = await mkdtemp(join(tmpdir(), "aisdk-toolkit-fs-"));
    try {
      const adapter = await LocalFileSystem.create({ root });
      await adapter.writeFile("nested/a.txt", Buffer.from("disk", "utf8"));
      expect((await adapter.readFile("nested/a.txt")).toString("utf8")).toBe("disk");
      expect(adapter.root).toBe(resolve(root));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("rejects symlinks that resolve outside root", async () => {
    const root = await mkdtemp(join(tmpdir(), "aisdk-toolkit-fs-"));
    const outside = await mkdtemp(join(tmpdir(), "aisdk-toolkit-fs-out-"));
    try {
      await writeFile(join(outside, "secret.txt"), "leak", "utf8");
      try {
        await symlink(join(outside, "secret.txt"), join(root, "link.txt"));
      } catch {
        return;
      }
      const adapter = await LocalFileSystem.create({ root });
      await expect(
        async () => adapter.readFile("link.txt"),
      ).rejects.toThrow(/outside root/);
    } finally {
      await rm(outside, { recursive: true, force: true });
      await rm(root, { recursive: true, force: true });
    }
  });

  test("allows .. when resolved path stays inside root", async () => {
    const root = await mkdtemp(join(tmpdir(), "aisdk-toolkit-fs-"));
    try {
      await mkdir(join(root, "nested"), { recursive: true });
      await writeFile(join(root, "peer.txt"), "peer", "utf8");
      const adapter = await LocalFileSystem.create({ root });
      expect(
        await adapter.readFile("nested/../peer.txt", { encoding: "utf8" }),
      ).toBe("peer");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("readDir and glob stay within root", async () => {
    const root = await mkdtemp(join(tmpdir(), "aisdk-toolkit-fs-"));
    try {
      await writeFile(join(root, "one.txt"), "1", "utf8");
      await mkdir(join(root, "sub"), { recursive: true });
      await writeFile(join(root, "sub", "two.txt"), "2", "utf8");
      const adapter = await LocalFileSystem.create({ root });
      const listed = await adapter.readDir(".");
      expect(listed.some((e) => e.path === "one.txt" && e.type === "file")).toBe(
        true,
      );
      expect(await adapter.glob("**/*.txt")).toEqual(
        expect.arrayContaining(["one.txt", "sub/two.txt"]),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("MemoryFileSystem", () => {
  test("initialFiles, readFile, writeFile, readDir", async () => {
    const adapter = await MemoryFileSystem.create({
      initialFiles: { "x/y.txt": "hi" },
    });
    expect((await adapter.readFile("x/y.txt")).toString("utf8")).toBe("hi");
    const listed = await adapter.readDir("x");
    expect(listed.some((e) => e.type === "file" && e.path === "x/y.txt")).toBe(true);
    await adapter.writeFile("x/z.txt", Buffer.from("z", "utf8"));
    expect((await adapter.readFile("x/z.txt")).toString("utf8")).toBe("z");
  });

  test("readFile returns Buffer or utf8 string from options", async () => {
    const adapter = await MemoryFileSystem.create({
      initialFiles: { "a/b.txt": "stream-me" },
    });
    expect((await adapter.readFile("a/b.txt")).toString("utf8")).toBe("stream-me");
    expect(await adapter.readFile("a/b.txt", { encoding: "utf8" })).toBe(
      "stream-me",
    );
  });

  test("writeFile accepts string with utf8 encoding", async () => {
    const adapter = await MemoryFileSystem.create();
    await adapter.writeFile("utf8.txt", "hello", { encoding: "utf8" });
    expect(await adapter.readFile("utf8.txt", { encoding: "utf8" })).toBe(
      "hello",
    );
  });

  test("createWriteStream replaces file contents", async () => {
    const adapter = await MemoryFileSystem.create();
    await adapter.writeFile("out.txt", Buffer.from("via-stream", "utf8"));
    expect((await adapter.readFile("out.txt")).toString("utf8")).toBe("via-stream");
  });

  test("ls stream without recursive yields immediate children only", async () => {
    const adapter = await MemoryFileSystem.create({
      initialFiles: {
        "a.txt": "a",
        "dir/b.txt": "b",
      },
    });
    const streamed: string[] = [];
    for await (const entry of adapter.ls("dir", { stream: true })) {
      streamed.push(`${entry.type}:${entry.path}`);
    }
    expect(streamed).toEqual(["file:dir/b.txt"]);
  });

  test("ls stream yields entries without buffering the full tree", async () => {
    const adapter = await MemoryFileSystem.create({
      initialFiles: {
        "a.txt": "a",
        "dir/b.txt": "b",
      },
    });
    const streamed: string[] = [];
    for await (const entry of adapter.ls(".", { recursive: true, stream: true })) {
      streamed.push(`${entry.type}:${entry.path}`);
    }
    expect(streamed).toContain("file:a.txt");
    expect(streamed).toContain("dir:dir");
    expect(streamed).toContain("file:dir/b.txt");
    const buffered = await adapter.ls(".", { recursive: true });
    expect(buffered.map((e) => `${e.type}:${e.path}`).sort()).toEqual(
      streamed.sort(),
    );
  });

  test("default glob and grep use readDir + readFile", async () => {
    const adapter = await MemoryFileSystem.create({
      initialFiles: {
        "src/a.ts": "const x = 1\n",
        "src/b.ts": "const y = 2\n",
        "README.md": "# doc\n",
      },
    });

    const tsFiles = await adapter.glob("src/**/*.ts");
    expect(tsFiles.sort()).toEqual(["src/a.ts", "src/b.ts"]);

    const hits = await adapter.grep({
      pattern: /const/,
      pathGlob: "src/*.ts",
    });
    expect(hits.map((h) => h.path)).toEqual(["src/a.ts", "src/b.ts"]);
  });
});
