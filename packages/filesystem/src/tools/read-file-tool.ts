import { tool } from "ai";
import { z } from "zod";
import { enforcePermissions } from "../permissions";
import { resolvePath } from "../path";
import type { FileSystemToolContext } from "./index";

const READ_FILE_DESCRIPTION =
  "Read the full UTF-8 text of a file at `path`. Use for inspecting source, configs, or logs before editing.";

const ReadFileOutputSchema = z.object({
  content: z.string().describe("Full UTF-8 file contents"),
});

export function createReadFileTool(options: FileSystemToolContext) {
  return tool({
    description: READ_FILE_DESCRIPTION,
    inputSchema: z.object({
      path: z.string().describe("File path (POSIX-style, forward slashes)"),
    }),
    outputSchema: ReadFileOutputSchema,
    execute: async ({ path }) => {
      const p = resolvePath(path);
      enforcePermissions({
        operation: "read",
        path: p,
        rules: options.permissions,
      });
      const content = await options.adapter.readFile(p, { encoding: "utf8" });
      return { content };
    },
  });
}

export { READ_FILE_DESCRIPTION };
