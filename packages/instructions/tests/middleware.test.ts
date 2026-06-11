import { describe, expect, test } from "vitest";
import { instructionsMiddleware } from "../src/middleware";

const userMessage = {
  role: "user" as const,
  content: [{ type: "text" as const, text: "hi" }],
};

describe("instructionsMiddleware", () => {
  test("replaces existing system messages with loaded instructions", async () => {
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
          { role: "system", content: "stale system" },
          userMessage,
        ],
      },
    });

    expect(result.prompt).toEqual([
      { role: "system", content: "Base rules\n\nTool hints" },
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
          { role: "system" as const, content: "old" },
          userMessage,
        ],
      },
    };

    const first = await transformParams(params);
    expect(first.prompt[0]).toEqual({ role: "system", content: "count: 1" });

    const second = await transformParams(params);
    expect(second.prompt[0]).toEqual({ role: "system", content: "count: 2" });
  });

  test("omits system message when all loaders are empty", async () => {
    const middleware = instructionsMiddleware({
      loaders: [() => "", async () => "   "],
    });
    const transformParams = middleware.transformParams;
    if (!transformParams) {
      throw new Error("expected transformParams");
    }

    const result = await transformParams({
      type: "generate",
      model: {} as never,
      params: {
        prompt: [{ role: "system", content: "old" }, userMessage],
      },
    });

    expect(result.prompt).toEqual([userMessage]);
  });
});
