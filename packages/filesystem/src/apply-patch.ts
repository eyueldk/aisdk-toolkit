import { applyDiff } from "@openai/agents";
import type { FileSystemAdapter } from "./adapters";
import {
  enforcePermissions,
  type FileSystemPermissionRule,
} from "./permissions";
import { resolvePath } from "./path";
import { dirname } from "pathe";

const BEGIN_PATCH = "*** Begin Patch";
const END_PATCH = "*** End Patch";

export type PatchOperation =
  | { kind: "add"; path: string; diff: string }
  | { kind: "delete"; path: string }
  | { kind: "update"; path: string; moveTo?: string; diff: string };

export type AppliedPatch =
  | { action: "add"; path: string }
  | { action: "update"; path: string }
  | { action: "delete"; path: string }
  | { action: "move"; path: string; moveTo: string };

export function parsePatch(patch: string): PatchOperation[] {
  const lines = normalizePatchLines(patch);
  const firstLine = lines[0]?.trim();
  const lastLine = lines.at(-1)?.trim();
  if (firstLine !== BEGIN_PATCH) {
    throw new Error(
      `Patch must start with ${BEGIN_PATCH}${firstLine ? ` (got: ${JSON.stringify(lines[0])})` : ""}`,
    );
  }
  if (lastLine !== END_PATCH) {
    throw new Error(
      `Patch must end with ${END_PATCH}${lastLine !== undefined ? ` (got: ${JSON.stringify(lines.at(-1))})` : ""}`,
    );
  }

  const operations: PatchOperation[] = [];
  let index = 1;

  while (index < lines.length - 1) {
    const line = lines[index];
    if (!line) {
      throw new Error("Unexpected empty patch line");
    }

    if (line.startsWith("*** Add File: ")) {
      const path = line.slice("*** Add File: ".length).trim();
      index += 1;
      const diffLines: string[] = [];
      while (index < lines.length - 1) {
        const diffLine = lines[index];
        if (!diffLine || isOperationHeader(diffLine)) break;
        diffLines.push(diffLine);
        index += 1;
      }
      operations.push({ kind: "add", path, diff: diffLines.join("\n") });
      continue;
    }

    if (line.startsWith("*** Delete File: ")) {
      const path = line.slice("*** Delete File: ".length).trim();
      operations.push({ kind: "delete", path });
      index += 1;
      continue;
    }

    if (line.startsWith("*** Update File: ")) {
      const path = line.slice("*** Update File: ".length).trim();
      index += 1;
      let moveTo: string | undefined;
      const moveLine = lines[index];
      if (moveLine?.startsWith("*** Move to: ")) {
        moveTo = moveLine.slice("*** Move to: ".length).trim();
        index += 1;
      }
      const diffLines: string[] = [];
      while (index < lines.length - 1) {
        const diffLine = lines[index];
        if (!diffLine || isOperationHeader(diffLine)) break;
        diffLines.push(diffLine);
        index += 1;
      }
      operations.push({ kind: "update", path, moveTo, diff: diffLines.join("\n") });
      continue;
    }

    throw new Error(`Unexpected patch line: ${line}`);
  }

  return operations;
}

export async function applyPatchOperations(
  adapter: FileSystemAdapter,
  operations: PatchOperation[],
  permissions: FileSystemPermissionRule[],
): Promise<AppliedPatch[]> {
  const applied: AppliedPatch[] = [];

  for (const operation of operations) {
    if (operation.kind === "add") {
      applied.push(await applyAdd(adapter, operation, permissions));
      continue;
    }
    if (operation.kind === "delete") {
      applied.push(await applyDelete(adapter, operation, permissions));
      continue;
    }
    applied.push(await applyUpdate(adapter, operation, permissions));
  }

  return applied;
}

async function applyAdd(
  adapter: FileSystemAdapter,
  operation: Extract<PatchOperation, { kind: "add" }>,
  permissions: FileSystemPermissionRule[],
): Promise<AppliedPatch> {
  const path = resolvePath(operation.path);
  enforcePermissions({ operation: "write", path, rules: permissions });

  if (await pathExists(adapter, path)) {
    throw new Error(`Refusing to add file: '${path}' already exists`);
  }

  const content = applyDiff("", operation.diff, "create");
  await adapter.writeFile(path, content, { encoding: "utf8" });
  return { action: "add", path };
}

async function applyDelete(
  adapter: FileSystemAdapter,
  operation: Extract<PatchOperation, { kind: "delete" }>,
  permissions: FileSystemPermissionRule[],
): Promise<AppliedPatch> {
  const path = resolvePath(operation.path);
  enforcePermissions({ operation: "write", path, rules: permissions });

  const existing = await findPathEntry(adapter, path);
  if (!existing) {
    throw new Error(`ENOENT: no such file: '${path}'`);
  }
  if (existing.type === "dir") {
    throw new Error(`Refusing to delete directory '${path}' via patch`);
  }

  await adapter.remove(path);
  return { action: "delete", path };
}

async function applyUpdate(
  adapter: FileSystemAdapter,
  operation: Extract<PatchOperation, { kind: "update" }>,
  permissions: FileSystemPermissionRule[],
): Promise<AppliedPatch> {
  const path = resolvePath(operation.path);
  enforcePermissions({ operation: "read", path, rules: permissions });
  enforcePermissions({ operation: "write", path, rules: permissions });

  const existing = await findPathEntry(adapter, path);
  if (!existing || existing.type !== "file") {
    throw new Error(`ENOENT: no such file: '${path}'`);
  }

  const before = await adapter.readFile(path, { encoding: "utf8" });
  const next = applyDiff(before, operation.diff, "default");

  if (operation.moveTo) {
    const moveTo = resolvePath(operation.moveTo);
    enforcePermissions({ operation: "write", path: moveTo, rules: permissions });
    if (await pathExists(adapter, moveTo)) {
      throw new Error(`Refusing to move: '${moveTo}' already exists`);
    }
    await adapter.writeFile(moveTo, next, { encoding: "utf8" });
    await adapter.remove(path);
    return { action: "move", path, moveTo };
  }

  await adapter.writeFile(path, next, { encoding: "utf8" });
  return { action: "update", path };
}

function normalizePatchLines(patch: string): string[] {
  const lines = stripMarkdownCodeFence(patch.trim())
    .split(/\r?\n/)
    .map((line) => line.replace(/\r$/, ""));
  while (lines.length > 0 && lines.at(-1) === "") {
    lines.pop();
  }
  return lines;
}

function stripMarkdownCodeFence(patch: string): string {
  if (!patch.startsWith("```")) {
    return patch;
  }
  return patch.replace(/^```[^\n]*\n?/, "").replace(/\n?```[^\n]*$/, "");
}

function isOperationHeader(line: string): boolean {
  return (
    line.startsWith("*** Add File: ") ||
    line.startsWith("*** Delete File: ") ||
    line.startsWith("*** Update File: ")
  );
}

async function pathExists(adapter: FileSystemAdapter, path: string) {
  return (await findPathEntry(adapter, path)) !== undefined;
}

async function findPathEntry(adapter: FileSystemAdapter, path: string) {
  if (path === "/") {
    return { type: "dir" as const, path: "/" };
  }

  const parent = dirname(path);
  const parentPath = parent === "." ? "." : resolvePath(parent);

  try {
    const entries = await adapter.readDir(parentPath);
    return entries.find((entry) => resolvePath(entry.path) === path);
  } catch {
    return undefined;
  }
}
