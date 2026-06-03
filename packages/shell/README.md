# @eyueldk/aisdk-toolkit-shell

[![npm](https://img.shields.io/npm/v/@eyueldk/aisdk-toolkit-shell)](https://www.npmjs.com/package/@eyueldk/aisdk-toolkit-shell)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/eyueldk/aisdk-toolkit/blob/main/LICENSE)

Pluggable shell command tools for the [Vercel AI SDK](https://ai-sdk.dev). Swap runtimes via **`ShellAdapter`** implementations.

## Features

- **`createShellToolkit({ adapter })`** → `{ tools, hint, state }`
- Tool: **`executeCommand`** with optional **`cwd`** per call (agent picks working directory)
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
import { createShellToolkit, LocalShell } from "@eyueldk/aisdk-toolkit-shell";

const adapter = await LocalShell.create();
const { tools, hint } = createShellToolkit({ adapter });

await generateText({
  model: yourLanguageModel,
  tools,
  stopWhen: stepCountIs(15),
  system: `You can run shell commands.\n\n${hint}`,
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

| Adapter | Factory | Notes |
| --- | --- | --- |
| **LocalShell** | `await LocalShell.create({ cwd?, env? })` | Host shell; **`stdin`** supported |
| **DockerShell** | `await DockerShell.create({ container, cwd?, env? })` | Pass a dockerode **`Container`**; `sh -c`; no **`stdin`** |
| **SshShell** | `await SshShell.create({ host, username, … })` | Persistent SSH; call **`dispose()`** when done |
| **DaytonaShell** | `await DaytonaShell.create({ sandbox, cwd?, env? })` | Default **`cwd`**: `workspace`; no **`stdin`** |

```ts
import { SshShell } from "@eyueldk/aisdk-toolkit-shell";

const ssh = await SshShell.create({
  host: "10.0.0.5",
  username: "deploy",
  privateKey: process.env.SSH_PRIVATE_KEY,
});
try {
  const { tools, hint } = createShellToolkit({ adapter: ssh });
  // …
} finally {
  await ssh.dispose();
}
```

## Configuration

### `executeCommand` tool input

| Option | Default | Description |
| --- | --- | --- |
| **`command`** | — | Shell command string |
| **`cwd`** | adapter default | Working directory for this command |
| **`timeoutMs`** | `120_000` | Max runtime |

### `adapter.exec` (advanced)

| Option | Default | Description |
| --- | --- | --- |
| **`cwd`** | adapter default | Working directory |
| **`env`** | merged layers | Extra environment variables |
| **`stdin`** | — | String or **`Readable`** (local/SSH only) |
| **`stdout`** / **`stderr`** | buffered | Optional **`Writable`** streams; result strings empty when streaming |

**Daytona:** set **`DAYTONA_API_KEY`** (and **`DAYTONA_API_URL`** for self-hosted). **`stderr`** in results is always empty (API returns combined stdout).

## Migration

### 1.2 → 1.3

- Tool renamed: **`runCommand`** → **`executeCommand`**.

### 1.3.x

- **`executeCommand`** accepts optional **`cwd`** per call so the agent picks the working directory (not on the toolkit factory).

## Troubleshooting

- **Daytona:** if commands fail with **`proxy.localhost`** DNS errors, map that host to loopback or use Daytona Cloud (see [Daytona docs](https://www.daytona.io/docs)).

## License

MIT — [eyueldk/aisdk-toolkit](https://github.com/eyueldk/aisdk-toolkit)
