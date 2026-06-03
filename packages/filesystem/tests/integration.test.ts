import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { ToolLoopAgent, stepCountIs } from "ai";
import { describe, expect, test } from "vitest";
import {
  MemoryFileSystem,
  createFileSystemToolkit,
} from "../src/index";

const MAGIC = "INTEGRATION_MAGIC_PHRASE_7f3a";
const openRouterModel = process.env.OPENROUTER_MODEL?.trim() ?? "";
const openRouterReady = Boolean(
  process.env.OPENROUTER_API_KEY?.trim() && openRouterModel,
);

describe.skipIf(!openRouterReady)(
  "filesystem toolkit + ToolLoopAgent (OpenRouter)",
  () => {
    test("agent reads file via readFile tool", async () => {
      const adapter = await MemoryFileSystem.create({
        initialFiles: { "note.txt": MAGIC },
      });
      const { tools, hint } = createFileSystemToolkit({ adapter });
      const agent = new ToolLoopAgent({
        model: createOpenRouter()(openRouterModel),
        instructions: `You can read files in a sandbox.\n\n${hint}`,
        tools,
        stopWhen: stepCountIs(12),
      });

      const result = await agent.generate({
        prompt: "Read note.txt and reply with only its exact contents.",
      });

      expect(
        result.steps.some((step) =>
          step.toolCalls?.some((call) => call.toolName === "readFile"),
        ),
      ).toBe(true);
      expect(result.text).toContain(MAGIC);
    });
  },
);
