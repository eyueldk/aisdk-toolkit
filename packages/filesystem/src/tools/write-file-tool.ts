import { tool } from "ai";
import { dirname } from "pathe";
import { z } from "zod";
import type { FileSystemAdapter } from "../adapters";
import { enforcePermissions } from "../permissions";
import { resolvePath } from "../path";
import type { FileSystemToolContext } from "./index";

const WRITE_FILE_DESCRIPTION =
  "Write UTF-8 text to a file at `path`. Creates parent directories when the adapter supports it. Set `overwrite: true` to replace an existing file; default refuses when the path already exists.";

const WriteFileOutputSchema = z.object({
  created: z
    .boolean()
    .describe("True when the file did not exist before this write"),
});

export function createWriteFileTool(options: FileSystemToolContext) {
  return tool({
    description: WRITE_FILE_DESCRIPTION,
    inputSchema: z.object({
      path: z.string().describe("File path (POSIX-style)"),
      contents: z.string().describe("Full new file contents"),
      overwrite: z
        .boolean()
        .optional()
        .describe(
          "Must be true to replace an existing file. Default false refuses overwrite.",
        ),
    }),
    outputSchema: WriteFileOutputSchema,
    execute: async ({ path, contents, overwrite = false }) => {
      const p = resolvePath(path);
      enforcePermissions({
        operation: "write",
        path: p,
        rules: options.permissions,
      });

      const existing = await findExistingPathEntry(options.adapter, p);
      if (existing?.type === "dir") {
        throw new Error(`Refusing to write file: '${p}' is a directory`);
      }
      if (existing?.type === "file" && !overwrite) {
        throw new Error(
          `Refusing to overwrite existing file '${p}'. Pass overwrite: true to replace it.`,
        );
      }

      await options.adapter.writeFile(p, contents, { encoding: "utf8" });
      return { created: !existing };
    },
  });
}

export { WRITE_FILE_DESCRIPTION };

async function findExistingPathEntry(adapter: FileSystemAdapter, path: string) {
  if (path === "/") return undefined;

  const parent = dirname(path);
  const parentPath = parent === "." ? "." : resolvePath(parent);

  try {
    const entries = await adapter.readDir(parentPath);
    return entries.find((entry) => resolvePath(entry.path) === path);
  } catch {
    return undefined;
  }
}
