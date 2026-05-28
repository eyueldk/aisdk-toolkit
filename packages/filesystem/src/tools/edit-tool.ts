import { tool } from "ai";
import { z } from "zod";
import { enforcePermissions } from "../permissions";
import { resolvePath } from "../path";
import type { CreateFileSystemToolsOptions } from "./index";

const EDIT_DESCRIPTION =
  "Edit a file by replacing `oldText` with `newText` in the UTF-8 contents at `path`. Fails if `oldText` is not found (unless `optional` is true).";

export function createEditTool(options: CreateFileSystemToolsOptions) {
  return tool({
    description: EDIT_DESCRIPTION,
    inputSchema: z.object({
      path: z.string().describe("File path (POSIX-style)"),
      oldText: z.string().describe("Text to find"),
      newText: z.string().describe("Replacement text"),
      replaceAll: z
        .boolean()
        .optional()
        .describe("Replace every occurrence (default: first only)"),
      optional: z
        .boolean()
        .optional()
        .describe("If true, succeed with a message when oldText is missing"),
    }),
    execute: async ({
      path,
      oldText,
      newText,
      replaceAll = false,
      optional = false,
    }) => {
      const p = resolvePath(path);
      enforcePermissions({
        operation: "read",
        path: p,
        rules: options.permissions,
      });
      enforcePermissions({
        operation: "write",
        path: p,
        rules: options.permissions,
      });

      let body = await options.adapter.readFile(p, { encoding: "utf8" });
      if (!body.includes(oldText)) {
        if (optional) {
          return `No change: oldText not found in '${p}'.`;
        }
        throw new Error(`oldText not found in '${p}'`);
      }
      const next = replaceAll
        ? body.split(oldText).join(newText)
        : body.replace(oldText, newText);
      await options.adapter.writeFile(p, next, { encoding: "utf8" });
      return `Updated '${p}' (${replaceAll ? "all" : "first"} occurrence(s)).`;
    },
  });
}

export { EDIT_DESCRIPTION };
