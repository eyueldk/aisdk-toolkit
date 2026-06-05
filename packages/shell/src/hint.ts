/** Optional system text when wiring {@link createShellToolkit}. */
export const SHELL_HINT = `# shell tools

You can run shell commands with **executeCommand**. Pass **cwd** on each call when the command should run outside the adapter default directory.

- **executeCommand** captures **stdout** and **stderr** separately as streamed chunks, then a final **exit** chunk. Every command has a max runtime (default **120s**; override with **timeoutMs**). **Do not** append \`2>&1\`, \`2>&1 |\`, or other shell redirects to merge stderr — that is unnecessary and hides which stream is which.
- Read **stdout** chunks for normal output and **stderr** chunks (prefixed \`[stderr]\` in model text) for diagnostics; check the final **exit** chunk for the exit code.
- Prefer short, focused commands.
- Long-running servers (e.g. \`pnpm run start\`) may time out — write logs to a file and use **readFile**, or run one-off commands.
- Piped stdout may be block-buffered; use \`stdbuf -oL\` / \`PYTHONUNBUFFERED=1\` when you need line-by-line output.
- Avoid destructive commands unless the user explicitly asked for them.
- Long output may be truncated; re-run with narrower commands if you need more detail.`;
