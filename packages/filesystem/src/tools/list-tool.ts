import { tool } from "ai";
import { z } from "zod";
import { collectVisibleEntries, enforcePermissions } from "../permissions";
import { resolvePath } from "../path";
import type { FileSystemToolContext } from "./index";

const LIST_DESCRIPTION =
  "List entries under `path` with `type` (file or dir) and `path` via the adapter `ls`. Optional `recursive` lists the whole subtree (flat).";

const ListEntrySchema = z.object({
  type: z.enum(["file", "dir"]).describe("Entry kind"),
  path: z.string().describe("Entry path relative to the adapter root"),
});

const ListOutputSchema = z.object({
  entries: z.array(ListEntrySchema).describe("Visible entries"),
});

export function createListTool(options: FileSystemToolContext) {
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
        .describe(
          "If true, list all files and directories under `path` (flat list). Default false.",
        ),
    }),
    outputSchema: ListOutputSchema,
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
      return { entries };
    },
  });
}

export { LIST_DESCRIPTION };
