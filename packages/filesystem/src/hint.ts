/** Optional system text when wiring {@link createFileSystemToolkit}. */
export const FILE_SYSTEM_HINT = `# filesystem tools

You have **read**, **write**, **edit** (search/replace in a file), **list** (directory listing), **glob** (find paths by pattern), and **grep** (search file contents with a regex). Paths are POSIX-style (forward slashes). Prefer **read** before **edit** when you need exact surrounding context.

- Use **list** or **glob** to discover paths before reading or editing.
- Use **write** to create or fully replace a file; use **edit** for targeted changes when you know the exact \`oldText\` to replace.
- Respect any configured permission rules: if a path is denied, do not attempt that operation on it.`;
