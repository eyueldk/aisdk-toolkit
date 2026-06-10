import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { ToolLoopAgent, stepCountIs } from "ai";
import { describe, expect, test } from "vitest";
import { createSearchToolkit } from "../src/index";
import { FirecrawlSearch } from "../src/adapters/firecrawl-adapter";

const MAGIC = "INTEGRATION_SEARCH_PHRASE_9c2b";
const openRouterModel = process.env.OPENROUTER_MODEL?.trim() ?? "";
const firecrawlReady = Boolean(process.env.FIRECRAWL_API_KEY?.trim());
const openRouterReady = Boolean(
  process.env.OPENROUTER_API_KEY?.trim() && openRouterModel,
);

describe.skipIf(!openRouterReady || !firecrawlReady)(
  "search toolkit + ToolLoopAgent (OpenRouter + Firecrawl)",
  () => {
    test("agent uses search tool", async () => {
      const adapter = await FirecrawlSearch.create();
      const { tools, prompt } = createSearchToolkit({ adapter });
      const agent = new ToolLoopAgent({
        model: createOpenRouter()(openRouterModel),
        instructions: `You can search the web.\n\n${prompt()}`,
        tools,
        stopWhen: stepCountIs(12),
      });

      const result = await agent.generate({
        prompt: `Search the web for "${MAGIC}" and reply with the word "searched".`,
      });

      expect(
        result.steps.some((step) =>
          step.toolCalls?.some((call) => call.toolName === "search"),
        ),
      ).toBe(true);
    });
  },
);
