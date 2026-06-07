import type { Todo } from "./tools/write-todos-tool";

export type TodosPromptOptions = {
  todos?: Todo[];
};

const TODOS_PROMPT_BASE = `# todo list tools

You have access to the \`writeTodos\` tool to help you manage and plan complex objectives.
Use this tool for complex objectives to ensure that you are tracking each necessary step and giving the user visibility into your progress.
This tool is very helpful for planning complex objectives, and for breaking down these larger complex objectives into smaller steps.

It is critical that you mark todos as completed as soon as you are done with a step. Do not batch up multiple steps before marking them as completed.
For simple objectives that only require a few steps, it is better to just complete the objective directly and NOT use this tool.
Writing todos takes time and tokens, use it when it is helpful for managing complex many-step problems! But not for simple few-step requests.

## Important To-Do List Usage Notes to Remember
- The \`writeTodos\` tool should never be called multiple times in parallel.
- Don't be afraid to revise the To-Do list as you go. New information may reveal new tasks that need to be done, or old tasks that are irrelevant.`;

function formatTodos(todos: Todo[]): string {
  return todos
    .map((todo) => `- **${todo.status}:** ${todo.content}`)
    .join("\n");
}

/** System prompt text for agents using the todos toolkit. */
export function prompt(options?: TodosPromptOptions): string {
  const todos = options?.todos ?? [];
  if (todos.length === 0) {
    return TODOS_PROMPT_BASE;
  }

  return `${TODOS_PROMPT_BASE}

## Current todos

${formatTodos(todos)}`;
}
