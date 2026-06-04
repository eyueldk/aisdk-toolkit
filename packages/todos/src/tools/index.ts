import type { TodoState } from "../state";
import { createWriteTodosTool } from "./write-todos-tool";

export interface CreateTodoToolsOptions {
  state: TodoState;
}

/**
 * Builds AI SDK tools from a {@link TodoState} object (`{ todos }`). Merge with your other `tools` when calling
 * `generateText` / `streamText` / `ToolLoopAgent`.
 * @see https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
 */
export function createTodoTools(options: CreateTodoToolsOptions) {
  const writeTodos = createWriteTodosTool({
    state: options.state,
  });
  return { writeTodos } as const;
}
