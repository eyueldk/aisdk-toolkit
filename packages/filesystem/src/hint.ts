import type { FileSystemAdapter, FileStat } from "./adapters";
import type { FileSystemPermissionRule } from "./permissions";
import { resolveFileSystemPermissions } from "./permissions";

export const DEFAULT_PROMPT_OVERVIEW_MAX_DEPTH = 2;
export const DEFAULT_PROMPT_OVERVIEW_MAX_ENTRIES = 50;

export type FileSystemPromptOptions = {
  /** Active rules (pass resolved rules from toolkit `state.permissions`, or omit for default deny-all). */
  permissions?: FileSystemPermissionRule[];
  /** When set, appends a brief recursive listing overview of the adapter root. */
  adapter?: FileSystemAdapter;
  overviewMaxDepth?: number;
  overviewMaxEntries?: number;
};

const FILE_SYSTEM_PROMPT_BASE = `# filesystem tools

You have **readFile**, **writeFile**, **editFile** (search/replace in a file), **list** (directory listing), **glob** (find paths by pattern), and **grep** (search file contents with a regex). Paths are POSIX-style (forward slashes). Prefer **readFile** before **editFile** when you need exact surrounding context.

Each tool returns a **structured JSON object** with result-only fields (not a repeat of the tool input).

- Use **list** or **glob** to discover paths before reading or editing.
- Use **writeFile** to create new files; pass **\`overwrite: true\`** only when intentionally replacing an existing file. Use **editFile** for targeted changes when you know the exact \`oldText\` to replace — it returns a unified **\`diff\`** of the edit.
- Only use **readFile**, **grep**, **editFile**, and **writeFile** on paths permitted by the configured rules below.`;

/** System prompt text for agents using the filesystem toolkit. */
export async function prompt(
  options?: FileSystemPromptOptions,
): Promise<string> {
  const permissions = resolveFileSystemPermissions(options?.permissions);
  const sections = [
    FILE_SYSTEM_PROMPT_BASE,
    formatPermissionsForPrompt(permissions),
  ];

  if (options?.adapter) {
    sections.push(
      await formatFilesystemOverview(options.adapter, {
        maxDepth:
          options.overviewMaxDepth ?? DEFAULT_PROMPT_OVERVIEW_MAX_DEPTH,
        maxEntries:
          options.overviewMaxEntries ?? DEFAULT_PROMPT_OVERVIEW_MAX_ENTRIES,
      }),
    );
  }

  return sections.join("\n\n");
}

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

type OverviewOptions = {
  maxDepth: number;
  maxEntries: number;
};

async function formatFilesystemOverview(
  adapter: FileSystemAdapter,
  options: OverviewOptions,
): Promise<string> {
  const { entries, truncated } = await collectOverviewEntries(
    adapter,
    options,
  );

  if (entries.length === 0) {
    return `## Filesystem overview

The workspace root is empty (depth ≤ ${options.maxDepth}).`;
  }

  const lines = entries.map(formatOverviewEntry);
  const footer = truncated
    ? `\n… (${entries.length} entries shown; more paths exist — use **list** or **glob** for the full tree)`
    : "";

  return `## Filesystem overview

Brief snapshot from \`.\` (depth ≤ ${options.maxDepth}, ${entries.length} entries${truncated ? ", truncated" : ""}):

\`\`\`
${lines.join("\n")}${footer}
\`\`\``;
}

async function collectOverviewEntries(
  adapter: FileSystemAdapter,
  options: OverviewOptions,
): Promise<{ entries: FileStat[]; truncated: boolean }> {
  const entries: FileStat[] = [];
  let truncated = false;

  const visit = async (dir: string): Promise<void> => {
    if (truncated) return;

    const children = await adapter.readDir(dir);
    const sorted = [...children].sort(compareOverviewEntries);

    for (const entry of sorted) {
      if (entries.length >= options.maxEntries) {
        truncated = true;
        return;
      }

      entries.push(entry);

      if (
        entry.type === "dir" &&
        segmentDepth(entry.path) < options.maxDepth
      ) {
        await visit(entry.path);
      }
    }
  };

  await visit(".");
  return { entries, truncated };
}

function compareOverviewEntries(a: FileStat, b: FileStat): number {
  const depthDiff = segmentDepth(a.path) - segmentDepth(b.path);
  if (depthDiff !== 0) return depthDiff;
  if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
  return a.path.localeCompare(b.path);
}

function formatOverviewEntry(entry: FileStat): string {
  const indent = "  ".repeat(segmentDepth(entry.path));
  const name = entry.path.split("/").pop() ?? entry.path;
  return entry.type === "dir" ? `${indent}${name}/` : `${indent}${name}`;
}

function segmentDepth(path: string): number {
  const parts = path.split("/").filter((part) => part.length > 0);
  return Math.max(0, parts.length - 1);
}
