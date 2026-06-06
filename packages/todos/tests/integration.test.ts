import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { ToolLoopAgent, stepCountIs } from "ai";
import { describe, expect, test } from "vitest";
import { createTodosToolkit, type TodoState } from "../src/index";

const openRouterModel = process.env.OPENROUTER_MODEL?.trim() ?? "";
const openRouterReady = Boolean(
  process.env.OPENROUTER_API_KEY?.trim() && openRouterModel,
);

describe.skipIf(!openRouterReady)(
  "todos toolkit + ToolLoopAgent (OpenRouter)",
  () => {
    test("agent writes todos via writeTodos", async () => {
      const state: TodoState = { todos: [] };
      const { tools, prompt } = createTodosToolkit({ state });
      const agent = new ToolLoopAgent({
        model: createOpenRouter()(openRouterModel),
        instructions: `You manage a todo list.\n\n${prompt()}\n\nCall writeTodos once with the full list when creating tasks.`,
        tools,
        stopWhen: stepCountIs(12),
      });

      const result = await agent.generate({
        prompt:
          'Create exactly two todos: "Buy milk" with status pending, and "Walk dog" with status in_progress.',
      });

      expect(
        result.steps.some((step) =>
          step.toolCalls?.some((call) => call.toolName === "writeTodos"),
        ),
      ).toBe(true);
      expect(state.todos).toHaveLength(2);
      expect(
        state.todos.some((t) => /milk/i.test(t.content) && t.status === "pending"),
      ).toBe(true);
      expect(
        state.todos.some(
          (t) => /dog/i.test(t.content) && t.status === "in_progress",
        ),
      ).toBe(true);
    });
  },
);
