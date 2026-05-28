import { describe, expect, test, vi } from "vitest";
import { MemoryFileSystem } from "../src/index";
import {
  collectReadableFilePaths,
  enforcePermissions,
  evaluatePermission,
  isOperationAllowed,
  PermissionDeniedError,
} from "../src/permissions";

const rulesAllowSrcThenDenyRest = [
  { mode: "allow" as const, operations: ["read" as const], paths: ["src/**"] },
  { mode: "deny" as const, operations: ["read" as const], paths: ["**"] },
];

const rulesDenyAllThenAllowSrc = [
  { mode: "deny" as const, operations: ["read" as const], paths: ["**"] },
  { mode: "allow" as const, operations: ["read" as const], paths: ["src/**"] },
];

describe("evaluatePermission", () => {
  test("first matching rule wins (allow before deny)", () => {
    expect(
      evaluatePermission({
        operation: "read",
        path: "src/a.ts",
        rules: rulesAllowSrcThenDenyRest,
      }),
    ).toEqual({
      matched: true,
      mode: "allow",
      pattern: "src/**",
    });
    expect(
      evaluatePermission({
        operation: "read",
        path: "etc/x",
        rules: rulesAllowSrcThenDenyRest,
      }),
    ).toEqual({
      matched: true,
      mode: "deny",
      pattern: "**",
    });
  });

  test("first matching rule wins (deny before allow never reaches allow)", () => {
    expect(
      evaluatePermission({
        operation: "read",
        path: "src/a.ts",
        rules: rulesDenyAllThenAllowSrc,
      }),
    ).toEqual({
      matched: true,
      mode: "deny",
      pattern: "**",
    });
  });

  test("first matching path glob within a rule wins", () => {
    const r = [
      {
        mode: "deny" as const,
        operations: ["read" as const],
        paths: ["**", "src/**"],
      },
    ];
    expect(
      evaluatePermission({ operation: "read", path: "src/a.ts", rules: r }),
    ).toEqual({
      matched: true,
      mode: "deny",
      pattern: "**",
    });
  });

  test("no match → not matched (default allow)", () => {
    expect(
      evaluatePermission({
        operation: "write",
        path: "x",
        rules: [{ mode: "deny", operations: ["read"], paths: ["**"] }],
      }),
    ).toEqual({ matched: false });
  });
});

describe("isOperationAllowed", () => {
  test("short-circuit semantics match evaluate", () => {
    expect(
      isOperationAllowed({
        operation: "read",
        path: "src/a.ts",
        rules: rulesAllowSrcThenDenyRest,
      }),
    ).toBe(true);
    expect(
      isOperationAllowed({
        operation: "read",
        path: "secret/x",
        rules: rulesAllowSrcThenDenyRest,
      }),
    ).toBe(false);
    expect(
      isOperationAllowed({
        operation: "read",
        path: "src/a.ts",
        rules: rulesDenyAllThenAllowSrc,
      }),
    ).toBe(false);
    expect(isOperationAllowed({ operation: "read", path: "x", rules: undefined })).toBe(
      true,
    );
    expect(isOperationAllowed({ operation: "read", path: "x", rules: [] })).toBe(true);
  });
});

describe("collectReadableFilePaths", () => {
  test("does not readDir denied subtrees", async () => {
    const adapter = await MemoryFileSystem.create({
      initialFiles: {
        "ok.txt": "1",
        "secret/hidden.txt": "2",
      },
    });
    const readDir = vi.spyOn(adapter, "readDir");
    const paths = await collectReadableFilePaths(adapter, [
      { mode: "deny", operations: ["read"], paths: ["secret", "secret/**"] },
    ]);
    expect(paths).toEqual(["ok.txt"]);
    expect(readDir.mock.calls.map(([dir]) => dir)).not.toContain("secret");
    readDir.mockRestore();
  });
});

describe("enforcePermissions", () => {
  test("throws only on deny", () => {
    expect(() =>
      enforcePermissions({
        operation: "read",
        path: "src/a.ts",
        rules: rulesAllowSrcThenDenyRest,
      }),
    ).not.toThrow();
    expect(() =>
      enforcePermissions({
        operation: "read",
        path: "etc/x",
        rules: rulesAllowSrcThenDenyRest,
      }),
    ).toThrow(PermissionDeniedError);
  });
});
