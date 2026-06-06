import type { FileSystemPermissionRule } from "./permissions";
import { resolveFileSystemPermissions } from "./permissions";

export type FileSystemPromptOptions = {
  /** Active rules (pass resolved rules from toolkit `state.permissions`, or omit for default deny-all). */
  permissions?: FileSystemPermissionRule[];
};

const FILE_SYSTEM_PROMPT_BASE = `# filesystem tools

You have **readFile**, **writeFile**, **editFile** (search/replace in a file), **list** (directory listing), **glob** (find paths by pattern), and **grep** (search file contents with a regex). Paths are POSIX-style (forward slashes). Prefer **readFile** before **editFile** when you need exact surrounding context.

Each tool returns a **structured JSON object** with result-only fields (not a repeat of the tool input).

- Use **list** or **glob** to discover paths before reading or editing.
- Use **writeFile** to create new files; pass **\`overwrite: true\`** only when intentionally replacing an existing file. Use **editFile** for targeted changes when you know the exact \`oldText\` to replace — it returns a unified **\`diff\`** of the edit.
- Only use **readFile**, **grep**, **editFile**, and **writeFile** on paths permitted by the configured rules below.`;

function formatPermissionsForPrompt(rules: FileSystemPermissionRule[]): string {
  return `## Configured permissions

These rules are **already enforced** by the tools. Follow them when choosing paths — do not attempt content operations on denied paths.

Evaluation: **first matching glob wins** (rule order, then \`paths\` order within each rule). **read** and **write** apply to **file content** only; **list** and **glob** are not restricted.

\`\`\`json
${JSON.stringify(rules, null, 2)}
\`\`\`

- **read** — **readFile**, **grep**, and reading in **editFile**
- **write** — **writeFile** and writing in **editFile**
- Put specific **deny** rules before broader **allow** rules when both are needed`;
}

/** System prompt text for agents using the filesystem toolkit. */
export function prompt(options?: FileSystemPromptOptions): string {
  const permissions = resolveFileSystemPermissions(options?.permissions);
  return `${FILE_SYSTEM_PROMPT_BASE}

${formatPermissionsForPrompt(permissions)}`;
}
