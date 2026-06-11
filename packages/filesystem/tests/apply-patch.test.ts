import { describe, expect, test } from "vitest";
import { applyPatchOperations, parsePatch } from "../src/apply-patch";
import { MemoryFileSystem } from "../src/adapters/memory-adapter";

const allowAll = {
  permissions: [
    { mode: "allow" as const, operations: ["read" as const, "write" as const], paths: ["**"] },
  ],
};

const EXAMPLE_PATCH = `*** Begin Patch
*** Add File: hello.txt
+Hello world
*** Update File: src/app.py
*** Move to: src/main.py
@@ def greet():
-print("Hi")
+print("Hello, world!")
*** Delete File: obsolete.txt
*** End Patch`;

describe("parsePatch", () => {
  test("parses add, update with move, and delete operations", () => {
    expect(parsePatch(EXAMPLE_PATCH)).toEqual([
      { kind: "add", path: "hello.txt", diff: "+Hello world" },
      {
        kind: "update",
        path: "src/app.py",
        moveTo: "src/main.py",
        diff: `@@ def greet():
-print("Hi")
+print("Hello, world!")`,
      },
      { kind: "delete", path: "obsolete.txt" },
    ]);
  });

  test("rejects patches without envelope markers", () => {
    expect(() => parsePatch("*** Add File: x.txt\n+hi")).toThrow(
      /Begin Patch/,
    );
  });

  test("accepts markdown code fences and trailing whitespace around envelope", () => {
    const patch = `\`\`\`
*** Begin Patch
*** Add File: hello.txt
+Hello world
*** End Patch   
\`\`\``;
    expect(parsePatch(patch)).toEqual([
      { kind: "add", path: "hello.txt", diff: "+Hello world" },
    ]);
  });

  test("accepts trailing blank lines after end marker", () => {
    const patch = `${EXAMPLE_PATCH}\n\n`;
    expect(parsePatch(patch)).toHaveLength(3);
  });

  test("reports the last line when end marker is missing", () => {
    expect(() =>
      parsePatch(`*** Begin Patch
*** Add File: x.txt
+hi`),
    ).toThrow(/End Patch.*got: "\+hi"/);
  });
});

describe("applyPatchOperations", () => {
  test("applies opencode example patch", async () => {
    const adapter = await MemoryFileSystem.create({
      initialFiles: {
        "src/app.py": 'def greet():\nprint("Hi")\n',
        "obsolete.txt": "old",
      },
    });

    const applied = await applyPatchOperations(
      adapter,
      parsePatch(EXAMPLE_PATCH),
      allowAll.permissions,
    );

    expect(applied).toEqual([
      { action: "add", path: "hello.txt" },
      { action: "move", path: "src/app.py", moveTo: "src/main.py" },
      { action: "delete", path: "obsolete.txt" },
    ]);
    expect(await adapter.readFile("hello.txt", { encoding: "utf8" })).toBe(
      "Hello world",
    );
    expect(await adapter.readFile("src/main.py", { encoding: "utf8" })).toBe(
      'def greet():\nprint("Hello, world!")\n',
    );
    await expect(adapter.readFile("src/app.py")).rejects.toThrow();
    await expect(adapter.readFile("obsolete.txt")).rejects.toThrow();
  });
});
