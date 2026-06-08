import { tool } from "ai";
import { z } from "zod";
import type { FileInfo, FileSystemAdapter } from "../adapters";
import type { FileSystemToolContext } from "./index";

const LIST_DESCRIPTION =
  "List entries under `path` with `type` (file or dir) and `path`. Optional `recursive` lists the subtree (flat). With `recursive`, optional `maxDepth` limits levels below `path` (immediate children = depth 1). Optional `directoriesOnly` returns directories only.";

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
          "If true, list entries under `path` (flat list). Default false (immediate children only).",
        ),
      maxDepth: z
        .number()
        .int()
        .positive()
        .optional()
        .describe(
          "With `recursive: true`, maximum depth below `path` to include (immediate children = 1). Omit for the full subtree.",
        ),
      directoriesOnly: z
        .boolean()
        .optional()
        .describe("If true, return only directory entries. Default false."),
    }),
    outputSchema: ListOutputSchema,
    execute: async ({
      path = ".",
      recursive = false,
      maxDepth,
      directoriesOnly = false,
    }) => {
      let entries = await listAdapterEntries(options.adapter, path, {
        recursive,
        maxDepth,
      });
      if (directoriesOnly) {
        entries = entries.filter((entry) => entry.type === "dir");
      }
      return { entries };
    },
  });
}

export { LIST_DESCRIPTION };

type ListAdapterOptions = {
  recursive: boolean;
  maxDepth?: number;
};

async function listAdapterEntries(
  adapter: FileSystemAdapter,
  path: string,
  options: ListAdapterOptions,
): Promise<FileInfo[]> {
  if (!options.recursive) {
    return adapter.readDir(path);
  }
  if (options.maxDepth !== undefined) {
    return listEntriesMaxDepth(adapter, path, options.maxDepth);
  }
  return adapter.readDirRecursive(path);
}

async function listEntriesMaxDepth(
  adapter: FileSystemAdapter,
  dir: string,
  maxDepth: number,
): Promise<FileInfo[]> {
  const out: FileInfo[] = [];

  const visit = async (current: string, parentDepth: number): Promise<void> => {
    for (const entry of await adapter.readDir(current)) {
      const depth = parentDepth + 1;
      out.push(entry);
      if (entry.type === "dir" && depth < maxDepth) {
        await visit(entry.path, depth);
      }
    }
  };

  await visit(dir, 0);
  return out;
}
