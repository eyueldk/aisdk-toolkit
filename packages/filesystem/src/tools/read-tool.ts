import { tool } from "ai";
import { z } from "zod";
import { enforcePermissions } from "../permissions";
import { resolvePath } from "../path";
import type { CreateFileSystemToolsOptions } from "./index";

const READ_DESCRIPTION =
  "Read the full UTF-8 text of a file at `path`. Use for inspecting source, configs, or logs before editing.";

export function createReadTool(options: CreateFileSystemToolsOptions) {
  return tool({
    description: READ_DESCRIPTION,
    inputSchema: z.object({
      path: z.string().describe("File path (POSIX-style, forward slashes)"),
    }),
    execute: async ({ path }) => {
      const p = resolvePath(path);
      enforcePermissions({
        operation: "read",
        path: p,
        rules: options.permissions,
      });
      return await options.adapter.readFile(p, { encoding: "utf8" });
    },
  });
}

export { READ_DESCRIPTION };
