# @eyueldk/aisdk-toolkit-filesystem

[![npm](https://img.shields.io/npm/v/@eyueldk/aisdk-toolkit-filesystem)](https://www.npmjs.com/package/@eyueldk/aisdk-toolkit-filesystem)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/eyueldk/aisdk-toolkit/blob/main/LICENSE)

Pluggable filesystem tools for the [Vercel AI SDK](https://ai-sdk.dev). Swap storage via **`FileSystemAdapter`** implementations.

## Features

- **`createFileSystemToolkit({ adapter, permissions? })`** → `{ tools, hint, state }`
- Tools: **`read`**, **`write`**, **`edit`**, **`list`**, **`glob`**, **`grep`**
- Optional path **permissions** (first matching glob wins)
- Adapters: memory, local disk, Docker container, Daytona sandbox

## Install

```bash
pnpm add @eyueldk/aisdk-toolkit-filesystem
```

Requires **Node 20+**.

## Quick start

```ts
import { generateText, stepCountIs } from "ai";
import {
  createFileSystemToolkit,
  MemoryFileSystem,
} from "@eyueldk/aisdk-toolkit-filesystem";

const adapter = await MemoryFileSystem.create({
  initialFiles: { "README.md": "# hi" },
});
const { tools, hint } = createFileSystemToolkit({ adapter });

await generateText({
  model: yourLanguageModel,
  tools,
  stopWhen: stepCountIs(20),
  system: `You can use filesystem tools.\n\n${hint}`,
  prompt: "Read README.md and summarize it in one sentence.",
});
```

## Adapters

| Adapter | Factory | Notes |
| --- | --- | --- |
| **MemoryFileSystem** | `await MemoryFileSystem.create({ initialFiles? })` | Volatile; tests and sandboxes |
| **LocalFileSystem** | `await LocalFileSystem.create({ root })` | Host paths under **`root`**; symlinks cannot escape **`root`** |
| **DockerFileSystem** | `await DockerFileSystem.create({ container, root?, docker? })` | Running container; list via **`find`** |
| **DaytonaFileSystem** | `await DaytonaFileSystem.create({ sandbox, root? })` or `{ sandboxId?, daytona? }` | Default **`root`**: `workspace` |

```ts
import { LocalFileSystem } from "@eyueldk/aisdk-toolkit-filesystem";

const disk = await LocalFileSystem.create({ root: "/path/to/workspace" });
```

Daytona (requires **`DAYTONA_API_KEY`**; optional **`DAYTONA_API_URL`** for self-hosted):

```ts
import { DaytonaFileSystem } from "@eyueldk/aisdk-toolkit-filesystem";
import { Daytona } from "@daytonaio/sdk";

const sandbox = await new Daytona().create();
const adapter = await DaytonaFileSystem.create({ sandbox, root: "workspace" });
```

Adapter paths are POSIX and normalized with **`resolvePath`**. **`..`** is allowed when the resolved path stays inside **`root`**.

## Permissions

```ts
createFileSystemToolkit({
  adapter,
  permissions: [{ mode: "deny", operations: ["write"], paths: ["etc/**"] }],
});
```

Rules: `{ mode: "allow" | "deny", operations: ["read" | "write"], paths: string[] }`. First match wins; no rule → allowed.

## Configuration

| API | Description |
| --- | --- |
| **`adapter.ls(path, { recursive?, stream? })`** | Default array; **`stream: true`** for large trees |
| **`createFileSystemTools`** | Tools only (no **`hint`** / **`state`**) |

## Troubleshooting

- **Docker:** needs a running container and POSIX **`find`** in the image.
- **Daytona:** sandbox create may succeed while file ops fail if the toolbox proxy is unreachable (self-hosted OSS: resolve **`proxy.localhost`** to loopback).

## License

MIT — [eyueldk/aisdk-toolkit](https://github.com/eyueldk/aisdk-toolkit)
