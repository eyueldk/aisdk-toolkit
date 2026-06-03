import { createTwoFilesPatch } from "diff";
import { tool } from "ai";
import { z } from "zod";
import { enforcePermissions } from "../permissions";
import { resolvePath } from "../path";
import type { FileSystemToolContext } from "./index";

const EDIT_FILE_DESCRIPTION =
  "Edit a file by replacing `oldText` with `newText` in the UTF-8 contents at `path`. Returns a unified diff of the change. Fails if `oldText` is not found (unless `optional` is true).";

const EditFileOutputSchema = z.object({
  changed: z.boolean().describe("Whether the file was modified"),
  diff: z
    .string()
    .describe("Unified diff of before vs after (empty when unchanged)"),
});

export function createEditFileTool(options: FileSystemToolContext) {
  return tool({
    description: EDIT_FILE_DESCRIPTION,
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
    outputSchema: EditFileOutputSchema,
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

      const body = await options.adapter.readFile(p, { encoding: "utf8" });
      if (!body.includes(oldText)) {
        if (optional) {
          return { changed: false, diff: "" };
        }
        throw new Error(`oldText not found in '${p}'`);
      }

      const next = replaceAll
        ? body.split(oldText).join(newText)
        : body.replace(oldText, newText);
      await options.adapter.writeFile(p, next, { encoding: "utf8" });
      return {
        changed: true,
        diff: formatUnifiedDiff(p, body, next),
      };
    },
  });
}

export { EDIT_FILE_DESCRIPTION };

function formatUnifiedDiff(path: string, before: string, after: string): string {
  return createTwoFilesPatch(path, path, before, after).trimEnd();
}
