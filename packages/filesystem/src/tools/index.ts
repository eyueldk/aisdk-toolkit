import type { FileSystemAdapter } from "../adapters";
import type { FileSystemEditMode } from "../hint";
import {
  resolveFileSystemPermissions,
  type FileSystemPermissionRule,
} from "../permissions";
import { createApplyPatchTool } from "./apply-patch-tool";
import { createEditFileTool } from "./edit-file-tool";
import { createGlobTool } from "./glob-tool";
import { createGrepTool } from "./grep-tool";
import { createMoveTool } from "./move-tool";
import { createReadFileTool } from "./read-file-tool";
import { createRemoveTool } from "./remove-tool";
import { createWriteFileTool } from "./write-file-tool";

export type FileSystemToolContext = {
  adapter: FileSystemAdapter;
  permissions: FileSystemPermissionRule[];
};

export type CreateFileSystemToolsOptions = {
  adapter: FileSystemAdapter;
  permissions?: FileSystemPermissionRule[];
  /**
   * `applyPatch` (default) exposes **applyPatch** instead of **writeFile** / **editFile** /
   * **remove** / **move**. `tools` keeps the granular edit tools.
   */
  editMode?: FileSystemEditMode;
};

export type ApplyPatchFileSystemTools = {
  readFile: ReturnType<typeof createReadFileTool>;
  applyPatch: ReturnType<typeof createApplyPatchTool>;
  glob: ReturnType<typeof createGlobTool>;
  grep: ReturnType<typeof createGrepTool>;
};

export type ClassicFileSystemTools = {
  readFile: ReturnType<typeof createReadFileTool>;
  writeFile: ReturnType<typeof createWriteFileTool>;
  editFile: ReturnType<typeof createEditFileTool>;
  remove: ReturnType<typeof createRemoveTool>;
  move: ReturnType<typeof createMoveTool>;
  glob: ReturnType<typeof createGlobTool>;
  grep: ReturnType<typeof createGrepTool>;
};

export type FileSystemTools = ApplyPatchFileSystemTools | ClassicFileSystemTools;

function createDiscoveryTools(ctx: FileSystemToolContext) {
  return {
    glob: createGlobTool(ctx),
    grep: createGrepTool(ctx),
  };
}

/**
 * Builds filesystem AI SDK tools for the Vercel AI SDK.
 * Pass `{ adapter, permissions? }` — same object {@link createFileSystemToolkit} accepts.
 */
export function createFileSystemTools(
  options: CreateFileSystemToolsOptions & { editMode?: "applyPatch" },
): ApplyPatchFileSystemTools;
export function createFileSystemTools(
  options: CreateFileSystemToolsOptions & { editMode: "tools" },
): ClassicFileSystemTools;
export function createFileSystemTools(
  options: CreateFileSystemToolsOptions,
): FileSystemTools {
  const ctx = {
    adapter: options.adapter,
    permissions: resolveFileSystemPermissions(options.permissions),
  };
  const editMode = options.editMode ?? "applyPatch";
  const discovery = createDiscoveryTools(ctx);

  if (editMode === "tools") {
    return {
      readFile: createReadFileTool(ctx),
      writeFile: createWriteFileTool(ctx),
      editFile: createEditFileTool(ctx),
      remove: createRemoveTool(ctx),
      move: createMoveTool(ctx),
      ...discovery,
    };
  }

  return {
    readFile: createReadFileTool(ctx),
    applyPatch: createApplyPatchTool(ctx),
    ...discovery,
  };
}
