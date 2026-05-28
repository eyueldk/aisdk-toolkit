import { tool } from "ai";
import { z } from "zod";
import safe from "safe-regex2";
import { matchGrepLines } from "../adapter";
import { collectReadableFilePaths } from "../permissions";
import { minimatch } from "minimatch";
import { normalizeGlobPattern, resolvePath } from "../path";
import type { CreateFileSystemToolsOptions } from "./index";

const GREP_DESCRIPTION =
  "Search UTF-8 file contents with a JavaScript RegExp (`pattern` string, optional `flags`). Optional `pathGlob` limits which files are searched (default: all files). Returns matches as `path:line: text` lines.";

export function createGrepTool(options: CreateFileSystemToolsOptions) {
  return tool({
    description: GREP_DESCRIPTION,
    inputSchema: z.object({
      pattern: z.string().describe("RegExp pattern (body only, not wrapped in slashes)"),
      flags: z
        .string()
        .optional()
        .describe("RegExp flags, e.g. `i` for case-insensitive"),
      pathGlob: z
        .string()
        .optional()
        .describe("Optional glob of file paths to include (e.g. `src/**/*.ts`)"),
    }),
    execute: async ({ pattern, flags, pathGlob }) => {
      assertSafeRegExpPattern(pattern);
      const re = new RegExp(pattern, flags ?? "");
      const pathGlobNorm = pathGlob ? normalizeGlobPattern(pathGlob) : undefined;

      let files = await collectReadableFilePaths(
        options.adapter,
        options.permissions,
      );
      if (pathGlobNorm) {
        files = files.filter((p) =>
          minimatch(resolvePath(p), pathGlobNorm, { dot: true }),
        );
      }

      const matches = [];
      for (const p of files) {
        matches.push(
          ...matchGrepLines(
            p,
            await options.adapter.readFile(p, { encoding: "utf8" }),
            re,
          ),
        );
      }

      if (!matches.length) return "(no matches)";
      return matches
        .map((m) => `${m.path}:${m.line}: ${m.text}`)
        .join("\n");
    },
  });
}

export { GREP_DESCRIPTION };

function assertSafeRegExpPattern(pattern: string): void {
  if (!safe(pattern)) {
    throw new Error(
      "Unsafe grep pattern (possible exponential backtracking). Simplify the expression.",
    );
  }
}
