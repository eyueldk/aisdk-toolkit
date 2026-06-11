# @eyueldk/aisdk-toolkit

Monorepo for [**@eyueldk/aisdk-toolkit-***](https://github.com/eyueldk/aisdk-toolkit) — composable [Vercel AI SDK](https://ai-sdk.dev) toolkits for agents (browser, HTTP, search, todos, filesystem, shell, instructions).

**Source:** [github.com/eyueldk/aisdk-toolkit](https://github.com/eyueldk/aisdk-toolkit)

## Packages

| Package | Version | Docs |
| --- | --- | --- |
| [@eyueldk/aisdk-toolkit-browser](packages/browser) | 3.0.0 | Playwright tools; **`prompt()`** |
| [@eyueldk/aisdk-toolkit-fetch](packages/fetch) | 2.0.0 | HTTP **`fetchRequest`** tool |
| [@eyueldk/aisdk-toolkit-search](packages/search) | 1.1.0 | Web **`search`** tool; Firecrawl + DuckDuckGo |
| [@eyueldk/aisdk-toolkit-todos](packages/todos) | 2.0.0 | **`writeTodos`** |
| [@eyueldk/aisdk-toolkit-filesystem](packages/filesystem) | 2.5.0 | **`applyPatch`** (default), **`glob`**, adapters |
| [@eyueldk/aisdk-toolkit-shell](packages/shell) | 2.3.0 | **`executeCommand`**; local, Docker, SSH, Daytona |
| [@eyueldk/aisdk-toolkit-instructions](packages/instructions) | 1.0.0 | **`createInstructionsToolkit`** — dynamic instructions **`middleware`** |

Each package is published independently to npm. Install and usage live in that package’s README.

## Monorepo development

```bash
pnpm install
pnpm check   # typecheck all packages
pnpm build   # build all packages
pnpm test    # browser → todos → filesystem → shell → fetch → search → instructions (sequential)
```

## License

MIT — [LICENSE](https://github.com/eyueldk/aisdk-toolkit/blob/main/LICENSE)
