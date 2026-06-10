# @eyueldk/aisdk-toolkit-filesystem

[![npm](https://img.shields.io/npm/v/@eyueldk/aisdk-toolkit-filesystem)](https://www.npmjs.com/package/@eyueldk/aisdk-toolkit-filesystem)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/eyueldk/aisdk-toolkit/blob/main/LICENSE)

Pluggable filesystem tools for the [Vercel AI SDK](https://ai-sdk.dev). Swap storage via **`FileSystemAdapter`** implementations.

## Features

- **`createFileSystemToolkit({ adapter, permissions?, editMode? })`** → `{ tools, prompt, state }`
- Default **`editMode: "applyPatch"`** — **`applyPatch`** (OpenCode-style patches) plus **`readFile`**, **`glob`**, **`grep`**
- **`editMode: "tools"`** — granular **`writeFile`**, **`editFile`**, **`remove`**, **`move`** instead of **`applyPatch`**
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
  system: `You can use filesystem tools.\n\n${prompt()}`,
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
| `@eyueldk/aisdk-toolkit-filesystem/adapters` | **FileSystemAdapter** types only |

The main entry (`@eyueldk/aisdk-toolkit-filesystem`) exports the toolkit and **FileSystemAdapter** — not concrete adapters.

| Adapter | Factory | Notes |
| --- | --- | --- |
| **MemoryFileSystem** | `await MemoryFileSystem.create({ initialFiles? })` | Volatile; tests and sandboxes |
| **LocalFileSystem** | `await LocalFileSystem.create({ root })` | Host paths under **`root`**; symlinks cannot escape **`root`** |
| **DockerFileSystem** | `await DockerFileSystem.create({ container, root?, docker? })` | Running container; list via **`find`** |
| **CompositeFileSystem** | `CompositeFileSystem.create({ mounts })` | Virtual union of adapters; mount keys must not overlap/nest |
| **DaytonaFileSystem** | `await DaytonaFileSystem.create({ sandbox, root? })` or `{ sandboxId?, daytona? }` | Default **`root`**: `workspace` |

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

Paths like **`sandbox/src/app.ts`** route to the sandbox adapter; **`host/README.md`** routes to the host adapter. Use **`glob`** on **`/`** to see mount names.

## Tool outputs

Each tool returns a **structured JSON object** with result-only fields (inputs like `path` or `pattern` are not echoed back).

| Tool | Result fields |
| --- | --- |
| **`readFile`** | `{ content }` |
| **`writeFile`** | `{ created }` — requires **`overwrite: true`** to replace an existing file |
| **`editFile`** | `{ changed, diff }` — **`diff`** is a unified diff (via [`diff`](https://github.com/kpdecker/jsdiff)) |
| **`applyPatch`** | `{ applied: [{ action, path, moveTo? }] }` — OpenCode patch envelope (`*** Begin Patch` … `*** End Patch`) |
| **`remove`** | `{ removed }` — pass **`recursive: true`** to delete directories (`editMode: "tools"`) |
| **`move`** | `{ moved }` (`editMode: "tools"`) |
| **`glob`** | `{ entries: [{ type, path }] }` — optional **`path`**, **`include`**, **`stream`** |
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

Rules: `{ mode: "allow" | "deny", operations: ["read" | "write"], paths: string[] }`. First match wins; unmatched paths are allowed when you supply explicit rules. **`read`** / **`write`** apply to **file content** only — **`glob`** is always available for path discovery.

**`prompt()`** is synchronous — it returns permissions as JSON and patch/edit guidance. With default **`editMode`**, it includes the OpenCode **`applyPatch`** format.

### `editMode`

| Value | Edit tools | System prompt |
| --- | --- | --- |
| **`applyPatch`** (default) | **`applyPatch`** | OpenCode patch language |
| **`tools`** | **`writeFile`**, **`editFile`**, **`remove`**, **`move`** | Granular edit tools |

```ts
createFileSystemToolkit({
  adapter,
  editMode: "tools",
  permissions: [{ mode: "allow", operations: ["read", "write"], paths: ["**"] }],
});
```

## Migration

### 2.4 → 2.5

- Default **`editMode: "applyPatch"`** — **`applyPatch`** replaces **`writeFile`** / **`editFile`** / **`remove`** / **`move`** unless you pass **`editMode: "tools"`**.
- **`prompt()`** documents the OpenCode patch format when **`editMode`** is **`applyPatch`**.
- Low-level helpers **`parsePatch`** and **`applyPatchOperations`** are exported; diffs use **`applyDiff`** from **`@openai/agents`**.
- **`CloudflareSandboxFileSystem`** and **`/adapters/cloudflare-sandbox`** removed.

### 2.3 → 2.4

- **`list`** tool removed — use **`glob`** with **`include: ["file", "dir"]`** and patterns such as `*` or `**`.
- **`glob`** returns **`{ entries: [{ type, path }] }`** (not `{ paths }`); optional **`path`**, **`include`**, **`stream`**.
- **`removeFile`** renamed **`remove`**; pass **`recursive: true`** to delete directories.
- New tools: **`move`**.
- Adapter methods: **`remove`**, **`mkdir`**, **`move`**; **`FileSystemAdapter.ls`** unchanged (adapter **`mkdir`** is not exposed as a tool).

### 2.1 → 2.2

- **`prompt()`** / **`filesystemPrompt()`** are synchronous again (no filesystem snapshot in the prompt).
- Adapter listing type renamed **`FileStat`** → **`FileInfo`** (and **`FileInfoType`**).

### 1.6.2 → 2.0

- Toolkit **`hint`** string replaced by **`prompt()`** — includes configured permissions (JSON). Standalone export: **`filesystemPrompt()`** (replaces **`FILE_SYSTEM_HINT`**).
- Omitted **`permissions`** defaults to **deny-all** for file content (**`read`** / **`write`**). **`glob`** is always available for path discovery.

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
