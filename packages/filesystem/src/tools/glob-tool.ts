import { tool } from "ai";
import { z } from "zod";
import { minimatch } from "minimatch";
import { collectAllFilePaths } from "../permissions";
import { normalizeGlobPattern, resolvePath } from "../path";
import type { FileSystemToolContext } from "./index";

const GLOB_DESCRIPTION =
  "List file paths matching a POSIX glob (minimatch semantics, forward slashes). Returns matching paths; empty when nothing matches.";

const GlobOutputSchema = z.object({
  paths: z.array(z.string()).describe("Matching file paths"),
});

export function createGlobTool(options: FileSystemToolContext) {
  return tool({
    description: GLOB_DESCRIPTION,
    inputSchema: z.object({
      pattern: z
        .string()
        .describe("Glob pattern (e.g. `src/**/*.ts`, `*.md`)"),
    }),
    outputSchema: GlobOutputSchema,
    execute: async ({ pattern }) => {
      const normPattern = normalizeGlobPattern(pattern);
      const files = await collectAllFilePaths(options.adapter);
      const paths = files
        .filter((p) => minimatch(resolvePath(p), normPattern, { dot: true }))
        .sort();
      return { paths };
    },
  });
}

export { GLOB_DESCRIPTION };
