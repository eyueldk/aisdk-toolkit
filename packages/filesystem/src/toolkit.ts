import { FILE_SYSTEM_HINT } from "./hint";
import {
  createFileSystemTools,
  type CreateFileSystemToolsOptions,
} from "./tools";

export type Toolkit<TTools extends Record<string, unknown>, TState> = {
  tools: TTools;
  hint: string;
  state: TState;
};

export type FileSystemTools = ReturnType<typeof createFileSystemTools>;

export type FileSystemToolkitState = CreateFileSystemToolsOptions;

export type FileSystemToolkit = Toolkit<FileSystemTools, FileSystemToolkitState>;

/**
 * Primary entry point: AI SDK `tools`, bundled `hint`, and `{ adapter, permissions }` on `state`.
 */
export function createFileSystemToolkit(
  options: CreateFileSystemToolsOptions,
): FileSystemToolkit {
  const tools = createFileSystemTools(options);
  return {
    tools,
    hint: FILE_SYSTEM_HINT,
    state: {
      adapter: options.adapter,
      permissions: options.permissions,
    },
  };
}
