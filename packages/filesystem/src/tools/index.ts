import type { FileSystemAdapter } from "../adapter";
import type { FileSystemPermissionRule } from "../permissions";
import { createEditFileTool } from "./edit-file-tool";
import { createGlobTool } from "./glob-tool";
import { createGrepTool } from "./grep-tool";
import { createListTool } from "./list-tool";
import { createReadFileTool } from "./read-file-tool";
import { createWriteFileTool } from "./write-file-tool";

export type CreateFileSystemToolsOptions = {
  adapter: FileSystemAdapter;
  permissions?: FileSystemPermissionRule[];
};

/**
 * Builds filesystem AI SDK tools (`readFile`, `writeFile`, `editFile`, `list`, `glob`, `grep`) for the Vercel AI SDK.
 * Pass `{ adapter, permissions? }` — same object {@link createFileSystemToolkit} accepts (toolkit adds `hint` and mirrors `state`).
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
