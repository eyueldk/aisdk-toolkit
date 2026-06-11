# @eyueldk/aisdk-toolkit-instructions

[![npm](https://img.shields.io/npm/v/@eyueldk/aisdk-toolkit-instructions)](https://www.npmjs.com/package/@eyueldk/aisdk-toolkit-instructions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/eyueldk/aisdk-toolkit/blob/main/LICENSE)

Dynamic instructions for the [Vercel AI SDK](https://ai-sdk.dev). Returns language-model **`middleware`** that replaces static `system` messages with content from **`loaders`** on every model call.

## Features

- **`createInstructionsToolkit({ loaders })`** — returns AI SDK **`middleware`**
- **`loaders`** — async or sync functions that return instruction text (empty results skipped)
- **`createAgentsMdLoader()`** — load **`AGENTS.md`** via **`FileSystemAdapter`** with boundary tags; optional **`learn`** mode
- Strips existing **`system`** messages and injects one combined system message

## Install

```bash
pnpm add @eyueldk/aisdk-toolkit-instructions
```

Requires **Node 20+**.

## Quick start

```ts
import { generateText, wrapLanguageModel } from "ai";
import { LocalFileSystem } from "@eyueldk/aisdk-toolkit-filesystem/adapters/local";
import { createFileSystemToolkit } from "@eyueldk/aisdk-toolkit-filesystem";
import {
  createAgentsMdLoader,
  createInstructionsToolkit,
} from "@eyueldk/aisdk-toolkit-instructions";

const adapter = await LocalFileSystem.create({ root: process.cwd() });
const { prompt: fsPrompt } = createFileSystemToolkit({ adapter });
const { middleware } = createInstructionsToolkit({
  loaders: [
    createAgentsMdLoader({ adapter, learn: true }),
    () => "You are a careful coding agent.",
    () => fsPrompt(),
  ],
});

const model = wrapLanguageModel({
  model: yourLanguageModel,
  middleware,
});

await generateText({
  model,
  tools,
  prompt: "List files in the project root.",
});
```

## Configuration

| Option | Default | Description |
| --- | --- | --- |
| **`loaders`** | (required) | Functions that return instruction text (sync or async). Empty/whitespace results are skipped. |
| **`separator`** | `\n\n` | Join string between non-empty loader results |

### Predefined loaders

| Factory | Description |
| --- | --- |
| **`createAgentsMdLoader({ adapter, path?, learn? })`** | Read **`AGENTS.md`** via a **`FileSystemAdapter`** (default **`path`**: `AGENTS.md`). **`learn: true`** adds instructions to automatically update AGENTS.md from session discoveries. Returns `""` if the file is missing and **`learn`** is false. |

## License

MIT — [eyueldk/aisdk-toolkit](https://github.com/eyueldk/aisdk-toolkit)
