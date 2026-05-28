import { tool } from "ai";
import { z } from "zod";
import { minimatch } from "minimatch";
import { collectReadableFilePaths } from "../permissions";
import { normalizeGlobPattern, resolvePath } from "../path";
import type { CreateFileSystemToolsOptions } from "./index";

const GLOB_DESCRIPTION =
  "List file paths matching a POSIX glob (minimatch semantics, forward slashes). Returns paths one per line; empty if nothing matches or all matches are denied by permissions.";

export function createGlobTool(options: CreateFileSystemToolsOptions) {
  return tool({
    description: GLOB_DESCRIPTION,
    inputSchema: z.object({
      pattern: z
        .string()
        .describe("Glob pattern (e.g. `src/**/*.ts`, `*.md`)"),
    }),
    execute: async ({ pattern }) => {
      const normPattern = normalizeGlobPattern(pattern);
      const files = await collectReadableFilePaths(
        options.adapter,
        options.permissions,
      );
      const allowed = files
        .filter((p) => minimatch(resolvePath(p), normPattern, { dot: true }))
        .sort();
      return allowed.length ? allowed.join("\n") : "(no matching paths)";
    },
  });
}

export { GLOB_DESCRIPTION };
