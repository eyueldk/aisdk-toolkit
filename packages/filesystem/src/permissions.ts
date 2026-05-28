import { minimatch } from "minimatch";
import type { FileStat, FileSystemAdapter } from "./adapter";
import { resolvePath } from "./path";

export type FileSystemPermissionMode = "allow" | "deny";

export type FileSystemPermissionOperation = "read" | "write";

/**
 * Declarative path + operation rules. Evaluated **in array order**:
 *
 * 1. For each rule (first → last), skip if `operations` does not include the op.
 * 2. For each `paths` glob in that rule (first → last), the **first** glob that matches the
 *    resolved target path **wins** for that rule: apply `mode` and **stop** (no later rules or
 *    patterns are considered).
 * 3. If no glob matches across all rules, access is **allowed** (use an early catch-all deny rule
 *    to default-deny).
 */
export interface FileSystemPermissionRule {
  mode: FileSystemPermissionMode;
  operations: FileSystemPermissionOperation[];
  paths: string[];
}

export class PermissionDeniedError extends Error {
  constructor(
    message: string,
    public readonly operation: FileSystemPermissionOperation,
    public readonly path: string,
  ) {
    super(message);
    this.name = "PermissionDeniedError";
  }
}

export type EvaluatePermissionParams = {
  operation: FileSystemPermissionOperation;
  /** Path to check (adapter-relative POSIX string; resolved before glob match). */
  path: string;
  rules: FileSystemPermissionRule[] | undefined;
};

/** Result of {@link evaluatePermission}: first matching glob wins, or none. */
export type PermissionResult =
  | { matched: false }
  | { matched: true; mode: FileSystemPermissionMode; pattern: string };

/**
 * Returns the **first** matching permission (rule order, then `paths` order). Stops as soon as a
 * glob matches. Use for explicit checks or custom error handling.
 */
export function evaluatePermission(
  params: EvaluatePermissionParams,
): PermissionResult {
  const { operation, path: targetPath, rules } = params;
  if (!rules?.length) return { matched: false };

  const resolvedPath = resolvePath(targetPath);

  for (const rule of rules) {
    if (!rule.operations.includes(operation)) continue;
    for (const pattern of rule.paths) {
      if (minimatch(resolvedPath, pattern, { dot: true })) {
        return { matched: true, mode: rule.mode, pattern };
      }
    }
  }

  return { matched: false };
}

/**
 * `true` if the operation is permitted (no match, or first match is `allow`). For callers that
 * want to short-circuit before expensive work.
 */
export function isOperationAllowed(params: EvaluatePermissionParams): boolean {
  const r = evaluatePermission(params);
  return !r.matched || r.mode === "allow";
}

/**
 * Throws {@link PermissionDeniedError} when the first matching rule is `deny`.
 * `rules` omitted or empty → allow all.
 */
export function enforcePermissions(params: EvaluatePermissionParams): void {
  const { operation, path: targetPath } = params;
  const r = evaluatePermission(params);
  if (r.matched && r.mode === "deny") {
    throw new PermissionDeniedError(
      `Denied ${operation} on "${targetPath}" (matched "${r.pattern}")`,
      operation,
      targetPath,
    );
  }
}

/** Keeps paths where `read` is allowed; skips denied paths without throwing. */
export function filterReadablePaths(
  paths: string[],
  rules: FileSystemPermissionRule[] | undefined,
): string[] {
  const allowed: string[] = [];
  for (const filePath of paths) {
    const p = resolvePath(filePath);
    if (isOperationAllowed({ operation: "read", path: p, rules })) {
      allowed.push(p);
    }
  }
  return allowed;
}

/**
 * Depth-first file paths under `dir`, skipping subtrees denied for `read`.
 * Does not call {@link FileSystemAdapter.readFile}; only {@link FileSystemAdapter.readDir}.
 */
export async function collectReadableFilePaths(
  adapter: FileSystemAdapter,
  rules: FileSystemPermissionRule[] | undefined,
  dir = ".",
): Promise<string[]> {
  const files: string[] = [];
  const visit = async (path: string): Promise<void> => {
    if (!isReadableDir(path, rules)) return;
    const entries = await adapter.readDir(path);
    for (const entry of entries) {
      if (!isOperationAllowed({ operation: "read", path: entry.path, rules })) {
        continue;
      }
      if (entry.type === "file") {
        files.push(entry.path);
      } else {
        await visit(entry.path);
      }
    }
  };
  await visit(dir);
  return files;
}

/**
 * Lists entries under `dir`, skipping subtrees denied for `read`.
 * When `recursive`, descends only into allowed directories.
 */
export async function collectVisibleEntries(
  adapter: FileSystemAdapter,
  rules: FileSystemPermissionRule[] | undefined,
  dir: string,
  recursive: boolean,
): Promise<FileStat[]> {
  const out: FileStat[] = [];
  const visit = async (path: string): Promise<void> => {
    if (!isReadableDir(path, rules)) return;
    const entries = await adapter.readDir(path);
    for (const entry of entries) {
      if (!isOperationAllowed({ operation: "read", path: entry.path, rules })) {
        continue;
      }
      out.push(entry);
      if (recursive && entry.type === "dir") {
        await visit(entry.path);
      }
    }
  };
  await visit(dir);
  return out;
}

function isReadableDir(
  dir: string,
  rules: FileSystemPermissionRule[] | undefined,
): boolean {
  return isOperationAllowed({
    operation: "read",
    path: resolvePath(dir),
    rules,
  });
}
