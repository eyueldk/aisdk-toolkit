import type { FileSystemAdapter } from "../adapter";
import type { FileSystemPermissionRule } from "../permissions";
import { createEditTool } from "./edit-tool";
import { createGlobTool } from "./glob-tool";
import { createGrepTool } from "./grep-tool";
import { createListTool } from "./list-tool";
import { createReadTool } from "./read-tool";
import { createWriteTool } from "./write-tool";

export type CreateFileSystemToolsOptions = {
  adapter: FileSystemAdapter;
  permissions?: FileSystemPermissionRule[];
};

/**
 * Builds filesystem AI SDK tools (`read`, `write`, `edit`, `list`, `glob`, `grep`) for the Vercel AI SDK.
 * Pass `{ adapter, permissions? }` — same object {@link createFileSystemToolkit} accepts (toolkit adds `hint` and mirrors `state`).
 */
export function createFileSystemTools(options: CreateFileSystemToolsOptions) {
  const ctx = {
    adapter: options.adapter,
    permissions: options.permissions,
  };
  return {
    read: createReadTool(ctx),
    write: createWriteTool(ctx),
    edit: createEditTool(ctx),
    list: createListTool(ctx),
    glob: createGlobTool(ctx),
    grep: createGrepTool(ctx),
  } as const;
}
