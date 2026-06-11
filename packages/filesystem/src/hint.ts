import type { FileSystemPermissionRule } from "./permissions";
import { resolveFileSystemPermissions } from "./permissions";

export type FileSystemEditMode = "applyPatch" | "tools";

export type FileSystemPromptOptions = {
  /** Active rules (pass resolved rules from toolkit `state.permissions`, or omit for default deny-all). */
  permissions?: FileSystemPermissionRule[];
  /** @default "applyPatch" */
  editMode?: FileSystemEditMode;
};

const APPLY_PATCH_PROMPT_BASE = `# filesystem tools

Use the **applyPatch** tool to edit files. Your patch language is a stripped-down, file-oriented diff format designed to be easy to parse and safe to apply. You can think of it as a high-level envelope:

*** Begin Patch
[ one or more file sections ]
*** End Patch

Within that envelope, you get a sequence of file operations.
You MUST include a header to specify the action you are taking.
Each operation starts with one of three headers:

*** Add File: <path> - create a new file. Every following line is a + line (the initial contents).
*** Delete File: <path> - remove an existing file. Nothing follows.
*** Update File: <path> - patch an existing file in place (optionally with a rename).

Example patch:

\`\`\`
*** Begin Patch
*** Add File: hello.txt
+Hello world
*** Update File: src/app.py
*** Move to: src/main.py
@@ def greet():
-print("Hi")
+print("Hello, world!")
*** Delete File: obsolete.txt
*** End Patch
\`\`\`

It is important to remember:

- You must include a header with your intended action (Add/Delete/Update)
- You must prefix new lines with \`+\` even when creating a new file
- The \`patch\` tool argument must include both envelope lines exactly: \`${"*** Begin Patch"}\` as the first line and \`${"*** End Patch"}\` as the last line (no text after it). Do not wrap the patch in markdown code fences when calling the tool.

You also have **readFile**, **glob** (find paths by pattern), and **grep** (search file contents with a regex). Paths are POSIX-style (forward slashes). Prefer **readFile** before patching when you need exact file contents.

Each tool returns a **structured JSON object** with result-only fields (not a repeat of the tool input).

- Use **glob** to discover paths before reading or patching. Set \`include: ["file", "dir"]\` as needed; use \`**\` in the pattern for nested matches (e.g. \`src/**\` for the whole tree under \`src\`).
- Only use **readFile**, **grep**, and **applyPatch** on paths permitted by the configured rules below.`;

const FILE_SYSTEM_TOOLS_PROMPT_BASE = `# filesystem tools

You have **readFile**, **writeFile**, **editFile** (search/replace in a file), **remove** (delete files or directories), **move**, **glob** (find paths by pattern), and **grep** (search file contents with a regex). Paths are POSIX-style (forward slashes). Prefer **readFile** before **editFile** when you need exact surrounding context.

Each tool returns a **structured JSON object** with result-only fields (not a repeat of the tool input).

- Use **glob** to discover paths before reading or editing. Set \`include: ["file", "dir"]\` as needed; use \`**\` in the pattern for nested matches (e.g. \`src/**\` for the whole tree under \`src\`).
- Use **writeFile** to create new files; pass **\`overwrite: true\`** only when intentionally replacing an existing file. Use **editFile** for targeted changes when you know the exact \`oldText\` to replace — it returns a unified **\`diff\`** of the edit. Use **remove** with \`recursive: true\` to delete directories.
- Only use **readFile**, **grep**, **editFile**, **writeFile**, **remove**, and **move** on paths permitted by the configured rules below.`;

/** System prompt text for agents using the filesystem toolkit. */
export function prompt(options?: FileSystemPromptOptions): string {
  const permissions = resolveFileSystemPermissions(options?.permissions);
  const editMode = options?.editMode ?? "applyPatch";
  const base =
    editMode === "applyPatch"
      ? APPLY_PATCH_PROMPT_BASE
      : FILE_SYSTEM_TOOLS_PROMPT_BASE;
  return [base, formatPermissionsForPrompt(permissions, editMode)].join("\n\n");
}

function formatPermissionsForPrompt(
  rules: FileSystemPermissionRule[],
  editMode: FileSystemEditMode,
): string {
  const writeTools =
    editMode === "applyPatch"
      ? "**applyPatch** (add/update/delete/move via patches)"
      : "**writeFile**, **remove**, **move**, and writing in **editFile**";
  const readTools =
    editMode === "applyPatch"
      ? "**readFile**, **grep**, and reading in **applyPatch** updates"
      : "**readFile**, **grep**, and reading in **editFile**";

  return `## Configured permissions

These rules are **already enforced** by the tools. Follow them when choosing paths — do not attempt content operations on denied paths.

Evaluation: **first matching glob wins** (rule order, then \`paths\` order within each rule). **read** and **write** apply to **file content** only; **glob** is not restricted.

\`\`\`json
${JSON.stringify(rules, null, 2)}
\`\`\`

- **read** — ${readTools}
- **write** — ${writeTools}
- Put specific **deny** rules before broader **allow** rules when both are needed`;
}
