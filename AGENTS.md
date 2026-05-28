## Learned User Preferences

- Prefer concise, complete package READMEs (install, usage, tools, scripts, migration notes when relevant); omit LangChain in published READMEs—keep upstream prompt attribution in source only.
- `@aimachine/browser` types align with **`puppeteer`**; **`puppeteer` is a peer dependency** (install alongside the package).
- In GitHub Actions, do not add a separate global npm upgrade for OIDC trusted publishing; rely on the npm shipped with the selected Node version.
- Prefer [pnpm/action-setup](https://github.com/pnpm/action-setup) for installs after `actions/setup-node`, using `run_install` (e.g. frozen lockfile) and caching when useful.
- Publish automation: reusable workflow parameterized by workspace package name; concrete workflows for `@aimachine/browser`, `@aimachine/todos`, and `@aimachine/filesystem` on pushes to `main` with package-scoped path filters (e.g. `packages/browser/**`), not repo-wide lockfile/workspace files unless explicitly requested.
- Keep the root `.cursor/hooks` tree out of version control (gitignore).
- Use one MIT `LICENSE` at the repo root only; omit per-package `LICENSE` files from published workspace packages and point README license links at the root file on GitHub.
- Do not add OpenRouter/live-model agent integration tests to workspace packages.
- Co-locate toolkit/tool option types with their factories (e.g. `tools/index.ts`); avoid separate `*-options.ts` files.
- **`@aimachine/filesystem`** **`FileSystemAdapter`** uses Node **`stream.Readable`** / **`stream.Writable`** from **`createReadStream`** / **`createWriteStream`**; **`readFile`** / **`writeFile`** default to **`Buffer`**; pass **`{ encoding: "utf8" }`** for string I/O. AI SDK tools use utf8 encoding on the adapter.

## Learned Workspace Facts

- Private monorepo root package is `aimachine`; published workspace packages include `@aimachine/browser` in `packages/browser`, `@aimachine/todos` in `packages/todos`, and `@aimachine/filesystem` in `packages/filesystem`.
- Package and docs use GitHub `https://github.com/eyueldk/aimachine` for repository, issues, and homepage links.
- `.github/workflows/publish.browser.yml`, `publish.todos.yml`, and `publish.filesystem.yml` run on `main` when the matching `packages/*/**` tree changes (and via `workflow_dispatch`); each calls `.github/workflows/reusable.publish.yml` (Node 24, `pnpm/action-setup@v6` frozen lockfile, `check`, `build`, `test`, `publish --no-git-checks`). Each package `prepublishOnly` runs `pnpm check && pnpm build`.
- `@aimachine/browser` `Session.close()` is async, stops inspectors, and closes the page; use `await session.close()` in teardown.
- Root `pnpm test` runs `@aimachine/browser` then `@aimachine/todos` then `@aimachine/filesystem` in sequence so parallel Vitest plus Puppeteer does not time out.
- `createBrowserToolkit` takes `{ page }`, constructs a `Session`, and returns `{ tools, hint, session }`. `createTodosToolkit` returns `{ tools, hint, state }` where `state` is a serializable `TodoState` (`{ todos }`). `createFileSystemToolkit` / `createFileSystemTools` take `{ adapter, permissions? }`; toolkit adds `hint` and returns `{ adapter, permissions }` on `state`. Merge `tools` and append `hint` to system/instructions.
- `@aimachine/filesystem` ships **`MemoryFileSystem`**, **`LocalFileSystem`**, and **`DockerFileSystem`** (each **`await …create(...)`** — memfs, host `root`, or dockerode container `root`). Adapter paths use **`resolvePath`**; **`..` is allowed when the resolved path stays inside `root`**; **`LocalFileSystem`** uses **`realpath`** so symlinks cannot escape **`root`**. **`DockerFileSystem`** **`readDir`** / **`readDirRecursive`** list via in-container **`find`** (GNU `-printf` or BusyBox `-type f`/`-type d`); read/write use **`getArchive`** / **`putArchive`**. Docker adapter tests use **Testcontainers** (`alpine`) when Docker is available.
- `@aimachine/filesystem` permission rules are **first-match** (`enforcePermissions` / `evaluatePermission`). **`glob`** / **`grep`** use **`collectReadableFilePaths`**; **`list`** uses **`collectVisibleEntries`** so denied subtrees are not traversed.
- `@aimachine/todos` uses camelCase AI SDK tool names (e.g. `writeTodos`, `viewTodos`); todo status literals are `pending`, `in_progress`, and `completed`.
- `@aimachine/filesystem` **`FileSystemAdapter.readDir(path)`** returns **`FileStat[]`** (immediate children); **`readDirRecursive(path)`** lists a flat subtree (DFS via **`readDir`**); **`ls(path, { recursive? })`** wraps those. Default **`glob`** / **`grep`** use **`ls(".", { recursive: true })`** and filter **`type === "file"`**.
