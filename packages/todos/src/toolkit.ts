import type { TodoState } from "./state";
import { prompt as todosPrompt } from "./hint";
import { createTodoTools, type CreateTodoToolsOptions } from "./tools";

export type Toolkit<TTools extends Record<string, unknown>, TState> = {
  tools: TTools;
  prompt: () => string;
  state: TState;
};

export type TodoTools = ReturnType<typeof createTodoTools>;

export type TodosToolkit = Toolkit<TodoTools, TodoState>;

export type CreateTodosToolkitOptions = CreateTodoToolsOptions;

/**
 * Primary entry point: AI SDK `tools`, a `prompt()` function for your system prompt, and the
 * serializable `TodoState` (`{ todos }`) as `state`. Pass `tools` / `prompt()` into `generateText`
 * (etc.); read or persist `state.todos` after the run.
 */
export function createTodosToolkit(
  options: CreateTodosToolkitOptions,
): TodosToolkit {
  const tools = createTodoTools(options);
  return {
    tools,
    prompt: () => todosPrompt({ todos: options.state.todos }),
    state: options.state,
  };
}
