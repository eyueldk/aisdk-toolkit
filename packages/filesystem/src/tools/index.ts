import type { FileSystemAdapter } from "../adapters";
import type { FileSystemPermissionRule } from "../permissions";
import { createEditFileTool } from "./edit-file-tool";
import { createGlobTool } from "./glob-tool";
import { createGrepTool } from "./grep-tool";
import { createListTool } from "./list-tool";
import { createReadFileTool } from "./read-file-tool";
import { createWriteFileTool } from "./write-file-tool";

export type FileSystemToolContext = {
  adapter: FileSystemAdapter;
  permissions?: FileSystemPermissionRule[];
};

export type CreateFileSystemToolsOptions = {
  adapter: FileSystemAdapter;
  permissions?: FileSystemPermissionRule[];
};

/**
 * Builds filesystem AI SDK tools (`readFile`, `writeFile`, `editFile`, `list`, `glob`, `grep`) for the Vercel AI SDK.
 * Pass `{ adapter, permissions? }` — same object {@link createFileSystemToolkit} accepts.
 */
export function createFileSystemTools(options: CreateFileSystemToolsOptions) {
  const ctx = {
    adapter: options.adapter,
    permissions: options.permissions,
  };
  return {
    readFile: createReadFileTool(ctx),
    writeFile: createWriteFileTool(ctx),
    editFile: createEditFileTool(ctx),
    list: createListTool(ctx),
    glob: createGlobTool(ctx),
    grep: createGrepTool(ctx),
  } as const;
}
