# @eyueldk/aisdk-toolkit

Monorepo for [**@eyueldk/aisdk-toolkit-***](https://github.com/eyueldk/aisdk-toolkit) — composable [Vercel AI SDK](https://ai-sdk.dev) toolkits for agents (browser, HTTP, todos, filesystem, shell).

**Source:** [github.com/eyueldk/aisdk-toolkit](https://github.com/eyueldk/aisdk-toolkit)

## Packages

| Package | Version | Docs |
| --- | --- | --- |
| [@eyueldk/aisdk-toolkit-browser](packages/browser) | 2.3.0 | Playwright tools; structured **`evaluate`** |
| [@eyueldk/aisdk-toolkit-fetch](packages/fetch) | 1.0.0 | HTTP `fetchRequest` tool |
| [@eyueldk/aisdk-toolkit-todos](packages/todos) | 1.3.0 | `writeTodos` |
| [@eyueldk/aisdk-toolkit-filesystem](packages/filesystem) | 1.5.1 | `readFile` / … / structured tool outputs |
| [@eyueldk/aisdk-toolkit-shell](packages/shell) | 1.4.2 | `executeCommand` separate stdout/stderr |

Each package is published independently to npm. Install and usage live in that package’s README.

## Monorepo development

```bash
pnpm install
pnpm check   # typecheck all packages
pnpm build   # build all packages
pnpm test    # browser → todos → filesystem → shell → fetch (sequential)
```

## License

MIT — [LICENSE](https://github.com/eyueldk/aisdk-toolkit/blob/main/LICENSE)
