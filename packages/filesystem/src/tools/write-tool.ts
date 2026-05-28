import { tool } from "ai";
import { z } from "zod";
import { enforcePermissions } from "../permissions";
import { resolvePath } from "../path";
import type { CreateFileSystemToolsOptions } from "./index";

const WRITE_DESCRIPTION =
  "Write UTF-8 text to a file at `path`, replacing any existing file contents. Creates parent directories when the adapter supports it.";

export function createWriteTool(options: CreateFileSystemToolsOptions) {
  return tool({
    description: WRITE_DESCRIPTION,
    inputSchema: z.object({
      path: z.string().describe("File path (POSIX-style)"),
      contents: z.string().describe("Full new file contents"),
    }),
    execute: async ({ path, contents }) => {
      const p = resolvePath(path);
      enforcePermissions({
        operation: "write",
        path: p,
        rules: options.permissions,
      });
      await options.adapter.writeFile(p, contents, { encoding: "utf8" });
      return `Wrote ${contents.length} characters to '${p}'.`;
    },
  });
}

export { WRITE_DESCRIPTION };
