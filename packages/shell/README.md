# @eyueldk/aisdk-toolkit-shell

[![npm](https://img.shields.io/npm/v/@eyueldk/aisdk-toolkit-shell)](https://www.npmjs.com/package/@eyueldk/aisdk-toolkit-shell)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/eyueldk/aisdk-toolkit/blob/main/LICENSE)

Pluggable shell command tools for the [Vercel AI SDK](https://ai-sdk.dev). Swap runtimes via **`ShellAdapter`** implementations.

## Features

- **`createShellToolkit({ adapter, defaultTimeoutMs? })`** → `{ tools, prompt, state }`
- Tool: **`executeCommand`** with optional **`cwd`** per call — streams structured stdout/stderr chunks, then an exit chunk (AI SDK async iterable **`execute`**)
- Adapters: local host, Docker container, SSH, Daytona sandbox
- **`adapter.exec`**: optional **`stdin`**, streaming **`stdout`** / **`stderr`** (local/SSH)

## Install

```bash
pnpm add @eyueldk/aisdk-toolkit-shell
```

Requires **Node 20+**.

## Quick start

```ts
import { generateText, stepCountIs } from "ai";
import { createShellToolkit } from "@eyueldk/aisdk-toolkit-shell";
import { LocalShell } from "@eyueldk/aisdk-toolkit-shell/adapters/local";

const adapter = await LocalShell.create();
const { tools, prompt } = createShellToolkit({ adapter });

await generateText({
  model: yourLanguageModel,
  tools,
  stopWhen: stepCountIs(15),
  system: `You can run shell commands.\n\n${prompt()}`,
  prompt: "Run `node -v` in /tmp and report the version.",
});
```

The agent passes **`cwd`** on **`executeCommand`** when it needs a specific directory:

```ts
await tools.executeCommand.execute({
  command: "npm test",
  cwd: "/path/to/project",
});
```

## Adapters

Import adapters from subpaths so bundlers (e.g. SSR) load only the runtime you need:

| Subpath | Adapter |
| --- | --- |
| `@eyueldk/aisdk-toolkit-shell/adapters/local` | **LocalShell** |
| `@eyueldk/aisdk-toolkit-shell/adapters/docker` | **DockerShell** |
| `@eyueldk/aisdk-toolkit-shell/adapters/ssh` | **SshShell** |
| `@eyueldk/aisdk-toolkit-shell/adapters/daytona` | **DaytonaShell** |
| `@eyueldk/aisdk-toolkit-shell/adapters` | **ShellAdapter** types only |

The main entry (`@eyueldk/aisdk-toolkit-shell`) exports the toolkit and **ShellAdapter** — not concrete adapters.

| Adapter | Factory | Notes |
| --- | --- | --- |
| **LocalShell** | `await LocalShell.create({ cwd?, env? })` | Host shell; **`stdin`** supported |
| **DockerShell** | `await DockerShell.create({ container, cwd?, env? })` | Pass a dockerode **`Container`**; `sh -c`; no **`stdin`** |
| **SshShell** | `await SshShell.create({ host, username, … })` | Persistent SSH; call **`dispose()`** when done |
| **DaytonaShell** | `await DaytonaShell.create({ sandbox, cwd?, env? })` | Default **`cwd`**: `workspace`; no **`stdin`** |

```ts
import { createShellToolkit } from "@eyueldk/aisdk-toolkit-shell";
import { SshShell } from "@eyueldk/aisdk-toolkit-shell/adapters/ssh";

const ssh = await SshShell.create({
  host: "10.0.0.5",
  username: "deploy",
  privateKey: process.env.SSH_PRIVATE_KEY,
});
try {
  const { tools, prompt } = createShellToolkit({ adapter: ssh });
  // …
} finally {
  await ssh.dispose();
}
```

## Configuration

| Option | Default | Description |
| --- | --- | --- |
| **`defaultTimeoutMs`** | `120_000` | Max runtime for **`executeCommand`** when the tool omits **`timeoutMs`** |

### `executeCommand` tool input

| Option | Default | Description |
| --- | --- | --- |
| **`command`** | — | Shell command string |
| **`cwd`** | adapter default | Working directory for this command |
| **`timeoutMs`** | `120_000` (or toolkit **`defaultTimeoutMs`**) | Max runtime; always enforced |

### `executeCommand` tool output

Streams result-only chunks (inputs are not echoed). Each chunk has a **`kind`**:

| **`kind`** | Fields |
| --- | --- |
| **`stdout`** | `{ text }` |
| **`stderr`** | `{ text }` |
| **`exit`** | `{ exitCode, signal }` |
| **`stdout`** (final) | `{ text }` — full consolidated transcript for the model |

**Streaming:** preliminary **`stdout`** / **`stderr`** / **`exit`** chunks update live UI. The **last** yielded chunk is a consolidated **`stdout`** transcript (plain stdout, **`[stderr]`**-prefixed stderr, **`[exit N]`** footer) so AI SDK 6 **`executeTool`** sends full output to the model on the next step.

**`toModelOutput`:** passes consolidated final **`stdout`** through unchanged; streamed stderr/exit chunks still map per-chunk for UI.

**Do not** add `2>&1` to commands — stdout and stderr are already captured on separate streams.

### `adapter.exec` (advanced)

| Option | Default | Description |
| --- | --- | --- |
| **`cwd`** | adapter default | Working directory |
| **`env`** | merged layers | Extra environment variables |
| **`stdin`** | — | String or **`Readable`** (local/SSH only) |
| **`stdout`** / **`stderr`** | buffered | Optional **`Writable`** streams; result strings empty when streaming |

**Daytona:** set **`DAYTONA_API_KEY`** (and **`DAYTONA_API_URL`** for self-hosted). **`stderr`** in results is always empty (API returns combined stdout).

## Migration

### 1.5.2 → 2.0

- Toolkit **`hint`** string replaced by **`prompt()`** — call **`prompt()`** in system/instructions. Standalone export: **`shellPrompt()`** (replaces **`SHELL_HINT`**).

### 1.5.1 → 1.5.2

- Adapter subpaths renamed from `/adapter/*` to `/adapters/*` (e.g. `@eyueldk/aisdk-toolkit-shell/adapters/local`).

### 1.5.0 → 1.5.1

- Adapter subpaths grouped under `/adapters/*`.

### 1.4.4 → 1.5.0

- Adapters are no longer exported from the main entry. Import from `/adapters/*` subpaths so SSR/bundlers avoid pulling unused backends (`dockerode`, `ssh2`, `@daytonaio/sdk`).

### 1.4.3 → 1.4.4

- **`executeCommand`** yields a final consolidated **`stdout`** chunk after **`exit`** so the model receives full stdout/stderr/exit text (AI SDK streaming tools only use the last yield as the final tool result). Remove downstream wrappers that duplicated this pattern.

### 1.4.2 → 1.4.3

- **`executeCommand`** always applies a timeout (default **`120_000`** ms). Optional toolkit **`defaultTimeoutMs`** on **`createShellTools`** / **`createShellToolkit`**. Stream consumption no longer blocks past adapter timeout.

### 1.4.1 → 1.4.2

- Tool description and **`prompt()`**: **do not** use `2>&1` — stdout and stderr are captured separately.
- **`toModelOutput`** prefixes stderr with **`[stderr]`** so the model can tell streams apart.

### 1.4.0 → 1.4.1

- **`toModelOutput`** sends stdout/stderr chunks to the model as plain text (fixes agents missing piped stdout).
- Fallback flush when stream hooks yield nothing but **`exec`** buffered stdout/stderr.

### 1.3 → 1.4

- **`executeCommand`** returns a **streaming async iterable** of structured chunks (`stdout` / `stderr` / `exit`) with **`outputSchema`**, not a formatted string.

### 1.2 → 1.3

- Tool renamed: **`runCommand`** → **`executeCommand`**.

### 1.3.x

- **`executeCommand`** accepts optional **`cwd`** per call so the agent picks the working directory (not on the toolkit factory).

## Troubleshooting

- **Daytona:** if commands fail with **`proxy.localhost`** DNS errors, map that host to loopback or use Daytona Cloud (see [Daytona docs](https://www.daytona.io/docs)).

## License

MIT — [eyueldk/aisdk-toolkit](https://github.com/eyueldk/aisdk-toolkit)
