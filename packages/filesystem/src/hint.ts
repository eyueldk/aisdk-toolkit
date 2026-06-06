import type { FileSystemPermissionRule } from "./permissions";
import { resolveFileSystemPermissions } from "./permissions";

export type FileSystemPromptOptions = {
  permissions?: FileSystemPermissionRule[];
};

const FILE_SYSTEM_PROMPT_BASE = `# filesystem tools

You have **readFile**, **writeFile**, **editFile** (search/replace in a file), **list** (directory listing), **glob** (find paths by pattern), and **grep** (search file contents with a regex). Paths are POSIX-style (forward slashes). Prefer **readFile** before **editFile** when you need exact surrounding context.

Each tool returns a **structured JSON object** with result-only fields (not a repeat of the tool input).

- Use **list** or **glob** to discover paths before reading or editing.
- Use **writeFile** to create new files; pass **\`overwrite: true\`** only when intentionally replacing an existing file. Use **editFile** for targeted changes when you know the exact \`oldText\` to replace — it returns a unified **\`diff\`** of the edit.
- **Permissions default to deny-all** until allow rules are configured. Respect the active rules: if a path is denied, do not attempt that operation on it.`;

function formatPermissionRules(rules: FileSystemPermissionRule[]): string {
  return rules
    .map(
      (rule) =>
        `- **${rule.mode}** ${rule.operations.join("/")} on \`${rule.paths.join("`, `")}\``,
    )
    .join("\n");
}

/** System prompt text for agents using the filesystem toolkit. */
export function prompt(options?: FileSystemPromptOptions): string {
  const permissions = resolveFileSystemPermissions(options?.permissions);
  return `${FILE_SYSTEM_PROMPT_BASE}

## Active permissions (first matching glob wins)

${formatPermissionRules(permissions)}`;
}
