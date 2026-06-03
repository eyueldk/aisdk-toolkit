/** Optional system text when wiring {@link createShellToolkit}. */
export const SHELL_HINT = `# shell tools

You can run shell commands with **executeCommand**. Pass **cwd** on each call when the command should run outside the adapter default directory.

- **executeCommand** streams structured chunks: **stdout** / **stderr** text, then a final **exit** chunk with code and signal. Inputs like **command** are not repeated in the output.
- Prefer short, focused commands; read streamed **stdout** / **stderr** and the final **exit** chunk.
- Avoid destructive commands unless the user explicitly asked for them.
- Long output may be truncated; re-run with narrower commands if you need more detail.`;