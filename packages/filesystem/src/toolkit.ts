import type { FileSystemAdapter } from "./adapters";
import { prompt as filesystemPrompt } from "./hint";
import {
  resolveFileSystemPermissions,
  type FileSystemPermissionRule,
} from "./permissions";
import {
  createFileSystemTools,
  type CreateFileSystemToolsOptions,
} from "./tools";

export type Toolkit<TTools extends Record<string, unknown>, TState> = {
  tools: TTools;
  prompt: () => string;
  state: TState;
};

export type FileSystemTools = ReturnType<typeof createFileSystemTools>;

export type FileSystemToolkitState = {
  adapter: FileSystemAdapter;
  permissions: FileSystemPermissionRule[];
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
  const tools = createFileSystemTools({ ...options, permissions });
  return {
    tools,
    prompt: () => filesystemPrompt({ permissions }),
    state: {
      adapter: options.adapter,
      permissions,
    },
  };
}
