# @aimachine/filesystem

[![npm](https://img.shields.io/npm/v/@aimachine/filesystem)](https://www.npmjs.com/package/@aimachine/filesystem)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/eyueldk/aimachine/blob/main/LICENSE)

**Version:** `0.1.0` (also in `package.json` `"version"`).

Pluggable **filesystem tools** for the [Vercel AI SDK](https://ai-sdk.dev) (`generateText`, `streamText`, `ToolLoopAgent`, …): **`createFileSystemToolkit({ adapter, permissions? })`** returns **`{ tools, hint, state }`**. Pass **`tools`** and **`hint`** (`FILE_SYSTEM_HINT`) into the AI SDK. **`state`** holds the same **`adapter`** and optional **`permissions`** you passed in.

Bundled backends: **`MemoryFileSystem`** (volatile [memfs](https://github.com/streamich/memfs)), **`LocalFileSystem`** (host disk under a **`root`** directory), **`DockerFileSystem`** ([dockerode](https://github.com/apocas/dockerode), files in a running container). Subclass **`FileSystemAdapter`** for custom storage.

**Repository:** [github.com/eyueldk/aimachine](https://github.com/eyueldk/aimachine) (`packages/filesystem`)

## Requirements

| | |
| --- | --- |
| **Node** | 20+ (`engines.node`) |
| **Runtime deps** | `ai` ^6, `zod` ^4, `minimatch` ^10, `memfs` ^4, `pathe` ^2, `dockerode` ^4, `tar-stream` ^3, `safe-regex2` ^5 |

**Docker adapter:** a running container, local Docker engine, and POSIX **`find`** in the image (Alpine/Debian). Listing uses **`find`** (GNU `-printf` when available, otherwise BusyBox `-type f` / `-type d`). **Local / Docker adapters:** adapter paths are normalized with **`resolvePath`**, then mapped under **`root`**; access is denied when the resolved host/container path would fall outside that root (`..` allowed when it stays inside). **`LocalFileSystem`** uses **`realpath`** so symlinks cannot escape **`root`**. Tools with permissions use **`collectReadableFilePaths`** / **`collectVisibleEntries`** so denied subtrees are not read or traversed.

Adapter-facing paths are POSIX (`src/a.ts`). **`resolvePath`** normalizes paths against a virtual `/` ([pathe](https://github.com/unjs/pathe)). Glob patterns use **`normalizeGlobPattern`** so `**` and `..` in patterns are not treated as filesystem traversal.

## Install

```bash
pnpm add @aimachine/filesystem
```

## Usage

1. Create an adapter (e.g. **`await MemoryFileSystem.create({ initialFiles? })`**).
2. **`createFileSystemToolkit({ adapter, permissions? })`** → `{ tools, hint, state }`.
3. Pass **`tools`** and **`hint`** into the AI SDK.

```ts
import { generateText, stepCountIs } from "ai";
import {
  createFileSystemToolkit,
  MemoryFileSystem,
} from "@aimachine/filesystem";

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

**Optional permissions** (first matching glob wins per operation):

```ts
const { tools, hint } = createFileSystemToolkit({
  adapter,
  permissions: [{ mode: "deny", operations: ["write"], paths: ["etc/**"] }],
});
```

**`createFileSystemTools`** is the same **`{ adapter, permissions? }`** object without **`hint`** / **`state`**. Individual **`createReadTool`**, **`createWriteTool`**, … factories are exported for custom tool sets.

### Adapters

| Adapter | Factory | Notes |
| --- | --- | --- |
| **MemoryFileSystem** | `await MemoryFileSystem.create({ initialFiles? })` | In-memory; good for tests and sandboxes |
| **LocalFileSystem** | `await LocalFileSystem.create({ root })` | Real disk under resolved **`root`** |
| **DockerFileSystem** | `await DockerFileSystem.create({ container, root?, docker? })` | Lists via in-container **`find`** (Alpine BusyBox or GNU); read/write via archive APIs |

```ts
import { LocalFileSystem, DockerFileSystem } from "@aimachine/filesystem";

const disk = await LocalFileSystem.create({ root: "/path/to/workspace" });
const container = await DockerFileSystem.create({
  container: "my-container-id-or-name",
  root: "/workspace",
});
```

Extend **`FileSystemAdapter`**: implement **`createReadStream`**, **`createWriteStream`**, and **`readDir`**. **`readFile`** / **`writeFile`** use those streams on the base class. Override **`glob`** / **`grep`** only when the default tree walk is not enough.

### Tools

`read`, `write`, `edit` (exact `oldText` → `newText`), `list` (optional `recursive`), `glob`, `grep` (RegExp + optional `pathGlob`). Tools enforce **`permissions`** on each path; **`list`** / **`glob`** / **`grep`** omit denied paths instead of throwing.

## Permissions

Rules are **`FileSystemPermissionRule[]`**: `{ mode: "allow" | "deny", operations: ["read" | "write"], paths: string[] }`. Evaluation is **first match wins** (rule order, then `paths` order). No matching rule → **allowed**. For default-deny, add an early catch-all **`deny`** rule.

Helpers: **`enforcePermissions`**, **`evaluatePermission`**, **`isOperationAllowed`**, **`filterReadablePaths`**, **`PermissionDeniedError`**.

## Scripts

`pnpm build` · `pnpm check` (`tsc --noEmit`) · `pnpm test` (when Docker is available, Docker adapter tests use **Testcontainers** to start **`alpine`**; otherwise they are skipped). **`prepublishOnly`** runs `pnpm check && pnpm build` before publish.

## Publishing

CI publishes this package when **`packages/filesystem/**`** changes on **`main`** (see [`.github/workflows/publish.filesystem.yml`](https://github.com/eyueldk/aimachine/blob/main/.github/workflows/publish.filesystem.yml)) or via **workflow_dispatch**. Configure [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/) for that workflow on the **`@aimachine/filesystem`** package.

## License

MIT — see [repository LICENSE](https://github.com/eyueldk/aimachine/blob/main/LICENSE).
