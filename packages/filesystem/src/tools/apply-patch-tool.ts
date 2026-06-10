import { tool } from "ai";
import { z } from "zod";
import { applyPatchOperations, parsePatch } from "../apply-patch";
import type { FileSystemToolContext } from "./index";

const APPLY_PATCH_DESCRIPTION =
  "Apply an OpenCode-style patch to create, update (optionally rename), or delete files. The system prompt documents the full patch language.";

const AppliedPatchSchema = z.object({
  action: z
    .enum(["add", "update", "delete", "move"])
    .describe("Operation applied"),
  path: z.string().describe("Affected path relative to the adapter root"),
  moveTo: z
    .string()
    .optional()
    .describe("Destination path when action is move"),
});

const ApplyPatchOutputSchema = z.object({
  applied: z.array(AppliedPatchSchema).describe("Operations applied in order"),
});

type ApplyPatchOutput = z.infer<typeof ApplyPatchOutputSchema>;

export function createApplyPatchTool(options: FileSystemToolContext) {
  return tool({
    description: APPLY_PATCH_DESCRIPTION,
    inputSchema: z.object({
      patch: z
        .string()
        .describe(
          "Patch envelope from `*** Begin Patch` through `*** End Patch`",
        ),
    }),
    outputSchema: ApplyPatchOutputSchema,
    execute: async ({ patch }): Promise<ApplyPatchOutput> => {
      const operations = parsePatch(patch);
      const applied = await applyPatchOperations(
        options.adapter,
        operations,
        options.permissions,
      );
      return {
        applied: applied.map((entry) =>
          entry.action === "move"
            ? {
                action: entry.action,
                path: entry.path,
                moveTo: entry.moveTo,
              }
            : { action: entry.action, path: entry.path },
        ),
      };
    },
  });
}

export { APPLY_PATCH_DESCRIPTION };
