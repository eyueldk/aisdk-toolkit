import { tool } from "ai";
import { z } from "zod";
import { minimatch } from "minimatch";
import type { FileInfo, FileInfoType, FileSystemAdapter } from "../adapters";
import { normalizeGlobPattern, resolvePath } from "../path";
import type { FileSystemToolContext } from "./index";

const GLOB_DESCRIPTION =
  "List paths under `path` matching a POSIX glob (`minimatch`, forward slashes). Use `**` in the pattern for nested matches. Optional `include` selects files and/or directories. Set `stream: true` to stream result batches for large trees.";

const GlobEntrySchema = z.object({
  type: z.enum(["file", "dir"]).describe("Entry kind"),
  path: z.string().describe("Entry path relative to the adapter root"),
});

const GlobOutputSchema = z.object({
  entries: z.array(GlobEntrySchema).describe("Matching entries"),
});

const IncludeSchema = z
  .array(z.enum(["file", "dir"]))
  .describe('Entry kinds to return (e.g. `["file", "dir"]`)');

const GLOB_STREAM_BATCH_SIZE = 32;

export function createGlobTool(options: FileSystemToolContext) {
  return tool({
    description: GLOB_DESCRIPTION,
    inputSchema: z.object({
      pattern: z
        .string()
        .describe("Glob pattern (e.g. `src/**/*.ts`, `*` for immediate children)"),
      path: z
        .string()
        .optional()
        .describe("Directory to search under (default `.`)"),
      include: IncludeSchema.optional(),
      stream: z
        .boolean()
        .optional()
        .describe(
          "When true, stream `{ entries }` batches instead of buffering the full result.",
        ),
    }),
    outputSchema: GlobOutputSchema,
    execute: async ({
      pattern,
      path = ".",
      include,
      stream = false,
    }) => {
      const includeSet = normalizeInclude(include);
      if (stream) {
        return globStream(options.adapter, path, pattern, includeSet);
      }
      const entries: FileInfo[] = [];
      for await (const entry of iterGlobMatches(
        options.adapter,
        path,
        pattern,
        includeSet,
      )) {
        entries.push(entry);
      }
      return { entries };
    },
  });
}

export { GLOB_DESCRIPTION };

function normalizeInclude(include?: FileInfoType[]): Set<FileInfoType> {
  if (!include?.length) {
    return new Set(["file", "dir"]);
  }
  return new Set(include);
}

async function* globStream(
  adapter: FileSystemAdapter,
  path: string,
  pattern: string,
  include: Set<FileInfoType>,
): AsyncGenerator<{ entries: FileInfo[] }> {
  let batch: FileInfo[] = [];
  for await (const entry of iterGlobMatches(adapter, path, pattern, include)) {
    batch.push(entry);
    if (batch.length >= GLOB_STREAM_BATCH_SIZE) {
      yield { entries: batch };
      batch = [];
    }
  }
  if (batch.length > 0) {
    yield { entries: batch };
  }
}

async function* iterGlobMatches(
  adapter: FileSystemAdapter,
  path: string,
  pattern: string,
  include: Set<FileInfoType>,
): AsyncGenerator<FileInfo> {
  const normPattern = normalizeGlobPattern(pattern);
  const listing = adapter.ls(path, { recursive: true, stream: true });
  for await (const entry of listing) {
    if (!include.has(entry.type)) continue;
    if (minimatch(resolvePath(entry.path), normPattern, { dot: true })) {
      yield entry;
    }
  }
}
