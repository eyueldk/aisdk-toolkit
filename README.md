# @eyueldk/aisdk-toolkit

Monorepo for [**@eyueldk/aisdk-toolkit-***](https://github.com/eyueldk/aisdk-toolkit) — composable [Vercel AI SDK](https://ai-sdk.dev) toolkits for agents (browser, HTTP, todos, filesystem, shell).

**Source:** [github.com/eyueldk/aisdk-toolkit](https://github.com/eyueldk/aisdk-toolkit)

## Packages

| Package | Version | Docs |
| --- | --- | --- |
| [@eyueldk/aisdk-toolkit-browser](packages/browser) | 2.1.3 | Playwright browser automation (active page, CDP attach) |
| [@eyueldk/aisdk-toolkit-fetch](packages/fetch) | 1.0.0 | HTTP `fetchRequest` tool |
| [@eyueldk/aisdk-toolkit-todos](packages/todos) | 1.2.1 | `writeTodos` / `readTodos` |
| [@eyueldk/aisdk-toolkit-filesystem](packages/filesystem) | 1.5.0 | `readFile` / … / structured tool outputs |
| [@eyueldk/aisdk-toolkit-shell](packages/shell) | 1.4.0 | `executeCommand` streaming structured output |

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
