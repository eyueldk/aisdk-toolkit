/** Optional system text when wiring {@link createShellToolkit}. */
export const SHELL_HINT = `# shell tools

You can run shell commands with **executeCommand**. Pass **cwd** on each call when the command should run outside the adapter default directory.

- Prefer short, focused commands; inspect **stdout** / **stderr** and the **exit code** in the tool result.
- Avoid destructive commands unless the user explicitly asked for them.
- Long output may be truncated in the tool response; re-run with narrower commands if you need more detail.`;
