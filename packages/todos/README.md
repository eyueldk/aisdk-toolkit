# @eyueldk/aisdk-toolkit-todos

[![npm](https://img.shields.io/npm/v/@eyueldk/aisdk-toolkit-todos)](https://www.npmjs.com/package/@eyueldk/aisdk-toolkit-todos)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/eyueldk/aisdk-toolkit/blob/main/LICENSE)

In-memory task list tools for the [Vercel AI SDK](https://ai-sdk.dev).

## Features

- **`writeTodos`** — replace the full todo list on each call
- **`readTodos`** — Markdown bullet list (read-only)
- **`createTodosToolkit({ state })`** → `{ tools, hint, state }`; **`state`** is serializable **`{ todos }`**
- Status values: `pending`, `in_progress`, `completed`

## Install

```bash
pnpm add @eyueldk/aisdk-toolkit-todos
```

Requires **Node 20+**.

## Quick start

```ts
import { generateText, stepCountIs } from "ai";
import { createTodosToolkit, type TodoState } from "@eyueldk/aisdk-toolkit-todos";

const state: TodoState = { todos: [] };
const { tools, hint } = createTodosToolkit({ state });

await generateText({
  model: yourLanguageModel,
  tools,
  stopWhen: stepCountIs(20),
  system: `You are a helpful assistant.\n\n${hint}`,
  prompt: "Plan three steps to explain why tests matter, using writeTodos.",
});

console.log(state.todos);
```

## Migration (1.2.0)

- **`viewTodos`** → **`readTodos`** (tool name and **`createReadTodosTool`** export).

## License

MIT — [eyueldk/aisdk-toolkit](https://github.com/eyueldk/aisdk-toolkit)
