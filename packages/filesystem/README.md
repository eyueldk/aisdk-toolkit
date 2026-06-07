# @eyueldk/aisdk-toolkit-filesystem

[![npm](https://img.shields.io/npm/v/@eyueldk/aisdk-toolkit-filesystem)](https://www.npmjs.com/package/@eyueldk/aisdk-toolkit-filesystem)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/eyueldk/aisdk-toolkit/blob/main/LICENSE)

Pluggable filesystem tools for the [Vercel AI SDK](https://ai-sdk.dev). Swap storage via **`FileSystemAdapter`** implementations.

## Features

- **`createFileSystemToolkit({ adapter, permissions? })`** → `{ tools, prompt, state }`
- Tools: **`readFile`**, **`writeFile`**, **`editFile`**, **`list`**, **`glob`**, **`grep`** — each returns a **structured object** (via AI SDK `outputSchema`)
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
import { createFileSystemToolkit } from "@eyueldk/aisdk-toolkit-filesystem";
import { MemoryFileSystem } from "@eyueldk/aisdk-toolkit-filesystem/adapters/memory";

const adapter = await MemoryFileSystem.create({
  initialFiles: { "README.md": "# hi" },
});
const { tools, prompt } = createFileSystemToolkit({
  adapter,
  permissions: [
    { mode: "allow", operations: ["read", "write"], paths: ["**"] },
  ],
});

await generateText({
  model: yourLanguageModel,
  tools,
  stopWhen: stepCountIs(20),
  system: `You can use filesystem tools.\n\n${await prompt()}`,
  prompt: "Read README.md and summarize it in one sentence.",
});
```

## Adapters

Import adapters from subpaths so bundlers (e.g. SSR) load only the runtime you need:

| Subpath | Adapter |
| --- | --- |
| `@eyueldk/aisdk-toolkit-filesystem/adapters/memory` | **MemoryFileSystem** |
| `@eyueldk/aisdk-toolkit-filesystem/adapters/local` | **LocalFileSystem** |
| `@eyueldk/aisdk-toolkit-filesystem/adapters/docker` | **DockerFileSystem** |
| `@eyueldk/aisdk-toolkit-filesystem/adapters/daytona` | **DaytonaFileSystem** |
| `@eyueldk/aisdk-toolkit-filesystem/adapters/composite` | **CompositeFileSystem** |
| `@eyueldk/aisdk-toolkit-filesystem/adapters/cloudflare-sandbox` | **CloudflareSandboxFileSystem** |
| `@eyueldk/aisdk-toolkit-filesystem/adapters` | **FileSystemAdapter** types only |

The main entry (`@eyueldk/aisdk-toolkit-filesystem`) exports the toolkit and **FileSystemAdapter** — not concrete adapters.

| Adapter | Factory | Notes |
| --- | --- | --- |
| **MemoryFileSystem** | `await MemoryFileSystem.create({ initialFiles? })` | Volatile; tests and sandboxes |
| **LocalFileSystem** | `await LocalFileSystem.create({ root })` | Host paths under **`root`**; symlinks cannot escape **`root`** |
| **DockerFileSystem** | `await DockerFileSystem.create({ container, root?, docker? })` | Running container; list via **`find`** |
| **CompositeFileSystem** | `CompositeFileSystem.create({ mounts })` | Virtual union of adapters; mount keys must not overlap/nest |
| **DaytonaFileSystem** | `await DaytonaFileSystem.create({ sandbox, root? })` or `{ sandboxId?, daytona? }` | Default **`root`**: `workspace` |
| **CloudflareSandboxFileSystem** | `await CloudflareSandboxFileSystem.create({ sandbox, root? })` | [Cloudflare Sandbox](https://developers.cloudflare.com/sandbox/) **`ISandbox`**; default **`root`**: `/workspace` |

```ts
import { getSandbox } from "@cloudflare/sandbox";
import { createFileSystemToolkit } from "@eyueldk/aisdk-toolkit-filesystem";
import { CloudflareSandboxFileSystem } from "@eyueldk/aisdk-toolkit-filesystem/adapters/cloudflare-sandbox";

const sandbox = getSandbox(env.Sandbox, "agent-1");
const adapter = await CloudflareSandboxFileSystem.create({ sandbox, root: "/workspace" });
const { tools, hint } = createFileSystemToolkit({ adapter });
```

```ts
import { LocalFileSystem } from "@eyueldk/aisdk-toolkit-filesystem/adapters/local";

const disk = await LocalFileSystem.create({ root: "/path/to/workspace" });
```

Daytona (requires **`DAYTONA_API_KEY`**; optional **`DAYTONA_API_URL`** for self-hosted):

```ts
import { DaytonaFileSystem } from "@eyueldk/aisdk-toolkit-filesystem/adapters/daytona";
import { Daytona } from "@daytonaio/sdk";

const sandbox = await new Daytona().create();
const adapter = await DaytonaFileSystem.create({ sandbox, root: "workspace" });
```

Adapter paths are POSIX and normalized with **`resolvePath`**. **`..`** is allowed when the resolved path stays inside **`root`**.

## Composite mounts

Combine adapters under virtual paths (mount keys must not nest):

```ts
import { createFileSystemToolkit } from "@eyueldk/aisdk-toolkit-filesystem";
import { CompositeFileSystem } from "@eyueldk/aisdk-toolkit-filesystem/adapters/composite";
import { LocalFileSystem } from "@eyueldk/aisdk-toolkit-filesystem/adapters/local";
import { MemoryFileSystem } from "@eyueldk/aisdk-toolkit-filesystem/adapters/memory";

const sandbox = await MemoryFileSystem.create();
const host = await LocalFileSystem.create({ root: "/project" });
const adapter = CompositeFileSystem.create({
  mounts: { "/sandbox": sandbox, "/host": host },
});

const { tools, prompt } = createFileSystemToolkit({
  adapter,
  permissions: [
    { mode: "allow", operations: ["read", "write"], paths: ["**"] },
  ],
});
```

Paths like **`sandbox/src/app.ts`** route to the sandbox adapter; **`host/README.md`** routes to the host adapter. List **`/`** to see mount names.

## Tool outputs

Each tool returns a **structured JSON object** with result-only fields (inputs like `path` or `pattern` are not echoed back).

| Tool | Result fields |
| --- | --- |
| **`readFile`** | `{ content }` |
| **`writeFile`** | `{ created }` — requires **`overwrite: true`** to replace an existing file |
| **`editFile`** | `{ changed, diff }` — **`diff`** is a unified diff (via [`diff`](https://github.com/kpdecker/jsdiff)) |
| **`list`** | `{ entries: [{ type, path }] }` |
| **`glob`** | `{ paths }` |
| **`grep`** | `{ matches: [{ path, line, text }] }` |

## Permissions

**Omitted `permissions` defaults to deny-all** (`read` and `write` on `**`). Add allow rules for paths the agent may access.

```ts
import { createFileSystemToolkit } from "@eyueldk/aisdk-toolkit-filesystem";

createFileSystemToolkit({
  adapter,
  permissions: [
    { mode: "deny", operations: ["write"], paths: ["etc/**"] },
    { mode: "allow", operations: ["read", "write"], paths: ["src/**"] },
  ],
});
```

Rules: `{ mode: "allow" | "deny", operations: ["read" | "write"], paths: string[] }`. First match wins; unmatched paths are allowed when you supply explicit rules. **`read`** / **`write`** apply to **file content** only — **`list`** and **`glob`** are always available for path discovery.

**`prompt()`** is async — it returns permissions as JSON plus a brief truncated filesystem overview (recursive listing, default depth **2**, max **50** entries). Override with **`overviewMaxDepth`** / **`overviewMaxEntries`** on **`filesystemPrompt({ adapter, permissions, … })`**.

**Cloudflare Sandbox:** pass an **`ISandbox`** from `getSandbox(env.Sandbox, id)` in your Worker.

## Migration

### 1.6.2 → 2.0

- Toolkit **`hint`** string replaced by **`await prompt()`** — async; includes configured permissions (JSON) and a truncated filesystem overview. Standalone export: **`filesystemPrompt()`** (replaces **`FILE_SYSTEM_HINT`**).
- Omitted **`permissions`** defaults to **deny-all** for file content (**`read`** / **`write`**). **`list`** and **`glob`** are always available for path discovery.
- **`CloudflareSandboxFileSystem`** for [Cloudflare Sandbox](https://developers.cloudflare.com/sandbox/) via `@eyueldk/aisdk-toolkit-filesystem/adapters/cloudflare-sandbox`.

### 1.6.1 → 1.6.2

- Adapter subpaths renamed from `/adapter/*` to `/adapters/*` (e.g. `@eyueldk/aisdk-toolkit-filesystem/adapters/local`).

### 1.6.0 → 1.6.1

- Adapter subpaths grouped under `/adapters/*`.

### 1.5.1 → 1.6.0

- Adapters are no longer exported from the main entry. Import from `/adapters/*` subpaths so SSR/bundlers avoid pulling unused backends (`dockerode`, `memfs`, `@daytonaio/sdk`, etc.).

### 1.5.0 → 1.5.1

- **`DockerFileSystem`** with **`root: "/"`** (default) no longer rejects absolute paths such as **`/workspace/...`**.

### 1.4 → 1.5

- All tools return **structured JSON objects** (with `outputSchema`) instead of plain strings.
- Outputs include **result-only fields** — tool inputs (`path`, `pattern`, etc.) and redundant counts are not echoed back.
- **`writeFile`** requires **`overwrite: true`** to replace an existing file; returns **`{ created }`**.
- **`editFile`** returns **`{ changed, diff }`** (unified diff via [`diff`](https://github.com/kpdecker/jsdiff)).

### 1.3 → 1.4

- **`CompositeFileSystem.create({ mounts })`** — combine adapters at virtual paths (e.g. `{ "/sandbox": sandboxAdapter }`); pass the result to **`createFileSystemToolkit({ adapter })`**.

### 1.2 → 1.3

- Tool names renamed: **`read`** → **`readFile`**, **`write`** → **`writeFile`**, **`edit`** → **`editFile`**.

## Configuration

| API | Description |
| --- | --- |
| **`adapter.ls(path, { recursive?, stream? })`** | Default array; **`stream: true`** for large trees |
| **`createFileSystemTools`** | Tools only (no **`prompt`** / **`state`**) — same default deny-all when **`permissions`** is omitted |

## Troubleshooting

- **Docker:** needs a running container and POSIX **`find`** in the image. Use **`root: "/"`** for full-container access, or **`root: "/workspace"`** (etc.) to scope the adapter to a subdirectory.
- **Daytona:** sandbox create may succeed while file ops fail if the toolbox proxy is unreachable (self-hosted OSS: resolve **`proxy.localhost`** to loopback).

## License

MIT — [eyueldk/aisdk-toolkit](https://github.com/eyueldk/aisdk-toolkit)
