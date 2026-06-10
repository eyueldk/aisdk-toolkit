import { tool } from "ai";
import { dirname } from "pathe";
import { z } from "zod";
import type { FileSystemAdapter } from "../adapters";
import { enforcePermissions } from "../permissions";
import { resolvePath } from "../path";
import type { FileSystemToolContext } from "./index";

const REMOVE_DESCRIPTION =
  "Delete the file or directory at `path`. Set `recursive: true` when removing a directory (and its contents).";

const RemoveOutputSchema = z.object({
  removed: z.literal(true).describe("Always true when the path was removed"),
});

export function createRemoveTool(options: FileSystemToolContext) {
  return tool({
    description: REMOVE_DESCRIPTION,
    inputSchema: z.object({
      path: z.string().describe("Path to remove (POSIX-style)"),
      recursive: z
        .boolean()
        .optional()
        .describe(
          "Required when removing a directory. Deletes the directory and its contents.",
        ),
    }),
    outputSchema: RemoveOutputSchema,
    execute: async ({ path, recursive = false }) => {
      const p = resolvePath(path);
      enforcePermissions({
        operation: "write",
        path: p,
        rules: options.permissions,
      });

      const existing = await findPathEntry(options.adapter, p);
      if (!existing) {
        throw new Error(`ENOENT: no such path: '${p}'`);
      }
      if (existing.type === "dir" && !recursive) {
        throw new Error(
          `Refusing to remove directory '${p}' without recursive: true`,
        );
      }

      await options.adapter.remove(p, { recursive });
      return { removed: true };
    },
  });
}

export { REMOVE_DESCRIPTION };

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
