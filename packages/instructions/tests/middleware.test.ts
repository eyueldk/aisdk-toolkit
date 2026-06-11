import { describe, expect, test } from "vitest";
import { instructionsMiddleware } from "../src/middleware";

const userMessage = {
  role: "user" as const,
  content: [{ type: "text" as const, text: "hi" }],
};

describe("instructionsMiddleware", () => {
  test("injects loaded instructions after existing system messages", async () => {
    const middleware = instructionsMiddleware({
      loaders: [() => "Base rules", async () => "Tool hints"],
    });
    const transformParams = middleware.transformParams;
    if (!transformParams) {
      throw new Error("expected transformParams");
    }

    const result = await transformParams({
      type: "generate",
      model: {} as never,
      params: {
        prompt: [
          { role: "system", content: "Existing system" },
          userMessage,
        ],
      },
    });

    expect(result.prompt).toEqual([
      { role: "system", content: "Existing system" },
      { role: "system", content: "Base rules" },
      { role: "system", content: "Tool hints" },
      userMessage,
    ]);
  });

  test("prepends instructions when no system messages exist", async () => {
    const middleware = instructionsMiddleware({
      loaders: [() => "Base rules"],
    });
    const transformParams = middleware.transformParams;
    if (!transformParams) {
      throw new Error("expected transformParams");
    }

    const result = await transformParams({
      type: "generate",
      model: {} as never,
      params: {
        prompt: [userMessage],
      },
    });

    expect(result.prompt).toEqual([
      { role: "system", content: "Base rules" },
      userMessage,
    ]);
  });

  test("runs loaders on each call", async () => {
    let count = 0;
    const middleware = instructionsMiddleware({
      loaders: [async () => `count: ${++count}`],
    });
    const transformParams = middleware.transformParams;
    if (!transformParams) {
      throw new Error("expected transformParams");
    }

    const params = {
      type: "generate" as const,
      model: {} as never,
      params: {
        prompt: [
          { role: "system" as const, content: "existing" },
          userMessage,
        ],
      },
    };

    const first = await transformParams(params);
    expect(first.prompt).toEqual([
      { role: "system", content: "existing" },
      { role: "system", content: "count: 1" },
      userMessage,
    ]);

    const second = await transformParams(params);
    expect(second.prompt).toEqual([
      { role: "system", content: "existing" },
      { role: "system", content: "count: 2" },
      userMessage,
    ]);
  });

  test("leaves the prompt unchanged when all loaders are empty", async () => {
    const middleware = instructionsMiddleware({
      loaders: [() => "", async () => "   "],
    });
    const transformParams = middleware.transformParams;
    if (!transformParams) {
      throw new Error("expected transformParams");
    }

    const originalPrompt = [
      { role: "system" as const, content: "existing" },
      userMessage,
    ];

    const result = await transformParams({
      type: "generate",
      model: {} as never,
      params: {
        prompt: originalPrompt,
      },
    });

    expect(result.prompt).toEqual(originalPrompt);
  });
});
