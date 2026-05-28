import { tool } from "ai";
import { z } from "zod";
import { collectVisibleEntries, enforcePermissions } from "../permissions";
import { resolvePath } from "../path";
import type { CreateFileSystemToolsOptions } from "./index";

const LIST_DESCRIPTION =
  "List entries under `path` with `type` (file or dir) and `path` via the adapter `ls`. Optional `recursive` lists the whole subtree (flat).";

export function createListTool(options: CreateFileSystemToolsOptions) {
  return tool({
    description: LIST_DESCRIPTION,
    inputSchema: z.object({
      path: z
        .string()
        .optional()
        .describe("Directory path (default: current root `.`)"),
      recursive: z
        .boolean()
        .optional()
        .describe("If true, list all files and directories under `path` (flat list). Default false."),
    }),
    execute: async ({ path = ".", recursive = false }) => {
      const p = resolvePath(path);
      enforcePermissions({
        operation: "read",
        path: p,
        rules: options.permissions,
      });
      const entries = await collectVisibleEntries(
        options.adapter,
        options.permissions,
        path,
        recursive,
      );
      return entries.length
        ? entries.map((e) => `${e.type}\t${e.path}`).join("\n")
        : "(empty directory)";
    },
  });
}

export { LIST_DESCRIPTION };
