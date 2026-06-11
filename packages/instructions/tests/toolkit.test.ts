import { describe, expect, test } from "vitest";
import { createInstructionsToolkit } from "../src/toolkit";

describe("createInstructionsToolkit", () => {
  test("returns middleware from loaders", async () => {
    const toolkit = createInstructionsToolkit({
      loaders: [() => "hello"],
    });

    expect(toolkit.middleware.specificationVersion).toBe("v3");
    const transformParams = toolkit.middleware.transformParams;
    if (!transformParams) {
      throw new Error("expected transformParams");
    }

    const result = await transformParams({
      type: "generate",
      model: {} as never,
      params: {
        prompt: [
          { role: "user" as const, content: [{ type: "text" as const, text: "hi" }] },
        ],
      },
    });

    expect(result.prompt[0]).toEqual({ role: "system", content: "hello" });
  });
});
