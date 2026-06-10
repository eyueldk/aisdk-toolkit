import { tool } from "ai";
import { dirname } from "pathe";
import { z } from "zod";
import type { FileSystemAdapter } from "../adapters";
import { enforcePermissions } from "../permissions";
import { resolvePath } from "../path";
import type { FileSystemToolContext } from "./index";

const MOVE_DESCRIPTION =
  "Move or rename a file or directory from `from` to `to` (POSIX paths).";

const MoveOutputSchema = z.object({
  moved: z.literal(true).describe("Always true when the path was moved"),
});

export function createMoveTool(options: FileSystemToolContext) {
  return tool({
    description: MOVE_DESCRIPTION,
    inputSchema: z.object({
      from: z.string().describe("Source path"),
      to: z.string().describe("Destination path"),
    }),
    outputSchema: MoveOutputSchema,
    execute: async ({ from, to }) => {
      const source = resolvePath(from);
      const destination = resolvePath(to);
      enforcePermissions({
        operation: "write",
        path: source,
        rules: options.permissions,
      });
      enforcePermissions({
        operation: "write",
        path: destination,
        rules: options.permissions,
      });

      if (!(await pathExists(options.adapter, source))) {
        throw new Error(`ENOENT: no such path: '${source}'`);
      }

      await options.adapter.move(source, destination);
      return { moved: true };
    },
  });
}

export { MOVE_DESCRIPTION };

async function pathExists(adapter: FileSystemAdapter, path: string) {
  return (await findPathEntry(adapter, path)) !== undefined;
}

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
