# @eyueldk/aisdk-toolkit-filesystem

[![npm](https://img.shields.io/npm/v/@eyueldk/aisdk-toolkit-filesystem)](https://www.npmjs.com/package/@eyueldk/aisdk-toolkit-filesystem)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/eyueldk/aisdk-toolkit/blob/main/LICENSE)

Pluggable filesystem tools for the [Vercel AI SDK](https://ai-sdk.dev). Swap storage via **`FileSystemAdapter`** implementations.

## Features

- **`createFileSystemToolkit({ adapter, permissions? })`** → `{ tools, hint, state }`
- Tools: **`readFile`**, **`writeFile`**, **`editFile`**, **`list`**, **`glob`**, **`grep`**
- Optional path **permissions** (first matching glob wins)
- Adapters: memory, local disk, Docker container, Daytona sandbox, **composite** (multiple mounts)

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
| **CompositeFileSystem** | `CompositeFileSystem.create({ mounts })` | Virtual union of adapters; mount keys must not overlap/nest |
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

## Composite mounts

Combine adapters under virtual paths (mount keys must not nest):

```ts
import {
  CompositeFileSystem,
  createFileSystemToolkit,
  LocalFileSystem,
  MemoryFileSystem,
} from "@eyueldk/aisdk-toolkit-filesystem";

const sandbox = await MemoryFileSystem.create();
const host = await LocalFileSystem.create({ root: "/project" });
const adapter = CompositeFileSystem.create({
  mounts: { "/sandbox": sandbox, "/host": host },
});

const { tools, hint } = createFileSystemToolkit({ adapter });
```

Paths like **`sandbox/src/app.ts`** route to the sandbox adapter; **`host/README.md`** routes to the host adapter. List **`/`** to see mount names.

## Permissions

```ts
createFileSystemToolkit({
  adapter,
  permissions: [{ mode: "deny", operations: ["write"], paths: ["etc/**"] }],
});
```

Rules: `{ mode: "allow" | "deny", operations: ["read" | "write"], paths: string[] }`. First match wins; no rule → allowed.

## Migration

### 1.3 → 1.4

- **`CompositeFileSystem.create({ mounts })`** — combine adapters at virtual paths (e.g. `{ "/sandbox": sandboxAdapter }`); pass the result to **`createFileSystemToolkit({ adapter })`**.

### 1.2 → 1.3

- Tool names renamed: **`read`** → **`readFile`**, **`write`** → **`writeFile`**, **`edit`** → **`editFile`**.

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
