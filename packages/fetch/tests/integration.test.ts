import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { ToolLoopAgent, stepCountIs } from "ai";
import { describe, expect, test } from "vitest";
import { createFetchToolkit } from "../src/index";

const openRouterModel = process.env.OPENROUTER_MODEL?.trim() ?? "";
const openRouterReady = Boolean(
  process.env.OPENROUTER_API_KEY?.trim() && openRouterModel,
);

describe.skipIf(!openRouterReady)(
  "fetch toolkit + ToolLoopAgent (OpenRouter)",
  () => {
    test("agent fetches a public page via fetchRequest", async () => {
      const { tools, prompt } = createFetchToolkit();
      const agent = new ToolLoopAgent({
        model: createOpenRouter()(openRouterModel),
        instructions: `You can fetch web pages.\n\n${prompt()}\n\nUse fetchRequest once with GET on the URL the user gives you.`,
        tools,
        stopWhen: stepCountIs(8),
      });

      const result = await agent.generate({
        prompt:
          "Fetch https://example.com with GET and tell me whether the body mentions Example Domain.",
      });

      expect(
        result.steps.some((step) =>
          step.toolCalls?.some((call) => call.toolName === "fetchRequest"),
        ),
      ).toBe(true);
      expect(result.text.toLowerCase()).toMatch(/example/);
    });
  },
);
