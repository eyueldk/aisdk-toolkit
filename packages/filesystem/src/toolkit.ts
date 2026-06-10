import type { FileSystemAdapter } from "./adapters";
import { prompt as filesystemPrompt, type FileSystemEditMode } from "./hint";
import {
  resolveFileSystemPermissions,
  type FileSystemPermissionRule,
} from "./permissions";
import {
  createFileSystemTools,
  type CreateFileSystemToolsOptions,
  type FileSystemTools,
} from "./tools";

export type Toolkit<TTools extends Record<string, unknown>, TState> = {
  tools: TTools;
  prompt: () => string;
  state: TState;
};

export type { FileSystemTools };

export type FileSystemToolkitState = {
  adapter: FileSystemAdapter;
  permissions: FileSystemPermissionRule[];
  editMode: FileSystemEditMode;
};

export type FileSystemToolkit = Toolkit<
  FileSystemTools,
  FileSystemToolkitState
>;

/**
 * Primary entry point: AI SDK `tools`, bundled `prompt()`, and `{ adapter, permissions }` on `state`.
 */
export function createFileSystemToolkit(
  options: CreateFileSystemToolsOptions,
): FileSystemToolkit {
  const permissions = resolveFileSystemPermissions(options.permissions);
  const editMode = options.editMode ?? "applyPatch";
  const tools =
    editMode === "tools"
      ? createFileSystemTools({ ...options, permissions, editMode: "tools" })
      : createFileSystemTools({ ...options, permissions, editMode: "applyPatch" });
  return {
    tools,
    prompt: () => filesystemPrompt({ permissions, editMode }),
    state: {
      adapter: options.adapter,
      permissions,
      editMode,
    },
  };
}
