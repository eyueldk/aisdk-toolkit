import { describe, expect, test } from "vitest";
import {
  createTodosToolkit,
  createTodoTools,
  TODOS_HINT,
  type TodoState,
} from "../src/index";

const toolOpts = { toolCallId: "test", messages: [] } as const;

describe("writeTodos tool", () => {
  test("replaces the full todo list on execute", async () => {
    const state: TodoState = { todos: [] };
    const { writeTodos } = createTodoTools({ state });

    const payload = {
      todos: [
        { content: "First", status: "in_progress" as const },
        { content: "Second", status: "pending" as const },
      ],
    };

    const result = await writeTodos.execute!(payload, {
      ...toolOpts,
      messages: [],
    });

    expect(typeof result).toBe("string");
    expect((result as string).includes("First")).toBe(true);
    expect(state.todos).toHaveLength(2);
    expect(state.todos[0]?.content).toBe("First");
    expect(state.todos[0]?.status).toBe("in_progress");
    expect(state.todos[1]?.status).toBe("pending");
  });

  test("second call replaces previous list", async () => {
    const state: TodoState = { todos: [] };
    const { writeTodos } = createTodoTools({ state });

    await writeTodos.execute!(
      {
        todos: [{ content: "A", status: "completed" }],
      },
      { ...toolOpts, messages: [] },
    );
    await writeTodos.execute!(
      {
        todos: [{ content: "B", status: "pending" }],
      },
      { ...toolOpts, messages: [] },
    );

    expect(state.todos).toHaveLength(1);
    expect(state.todos[0]?.content).toBe("B");
  });
});

describe("viewTodos tool", () => {
  test("returns markdown for empty list", async () => {
    const state: TodoState = { todos: [] };
    const { viewTodos } = createTodoTools({ state });

    const result = await viewTodos.execute!(
      {},
      { ...toolOpts, messages: [] },
    );

    expect(typeof result).toBe("string");
    expect(result).toContain("## Todos");
    expect(result).toContain("No tasks yet");
  });

  test("returns markdown list after writeTodos", async () => {
    const state: TodoState = { todos: [] };
    const { writeTodos, viewTodos } = createTodoTools({ state });

    await writeTodos.execute!(
      {
        todos: [
          { content: "Alpha", status: "in_progress" },
          { content: "Beta|gamma", status: "pending" },
        ],
      },
      { ...toolOpts, messages: [] },
    );

    const result = await viewTodos.execute!(
      {},
      { ...toolOpts, messages: [] },
    );

    expect(result).toContain("## Todos (2)");
    expect(result).toContain("- **in_progress:** Alpha");
    expect(result).toContain("- **pending:** Beta|gamma");
  });
});

describe("createTodosToolkit", () => {
  test("returns tools, hint, and state", () => {
    const state: TodoState = { todos: [] };
    const kit = createTodosToolkit({ state });
    expect(kit.tools.writeTodos).toBeDefined();
    expect(kit.tools.viewTodos).toBeDefined();
    expect(kit.hint).toBe(TODOS_HINT);
    expect(kit.state).toBe(state);
  });
});
