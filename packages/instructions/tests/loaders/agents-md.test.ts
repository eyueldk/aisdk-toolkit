import { MemoryFileSystem } from "@eyueldk/aisdk-toolkit-filesystem/adapters/memory";
import { describe, expect, test } from "vitest";
import { createAgentsMdLoader } from "../../src/loaders/agents-md";
import { instructionsMiddleware } from "../../src/middleware";

describe("createAgentsMdLoader", () => {
  test("reads AGENTS.md from the adapter root by default", async () => {
    const adapter = await MemoryFileSystem.create({
      initialFiles: { "AGENTS.md": "Agent rules here" },
    });
    const loader = createAgentsMdLoader({ adapter });
    expect(await loader()).toBe(
      [
        "The following instructions are loaded from AGENTS.md:",
        "",
        "<AGENTS.md>",
        "Agent rules here",
        "</AGENTS.md>",
      ].join("\n"),
    );
  });

  test("reads a custom adapter path", async () => {
    const adapter = await MemoryFileSystem.create({
      initialFiles: { "docs/AGENTS.md": "Docs rules" },
    });
    const loader = createAgentsMdLoader({ adapter, path: "docs/AGENTS.md" });
    expect(await loader()).toBe(
      [
        "The following instructions are loaded from docs/AGENTS.md:",
        "",
        "<docs/AGENTS.md>",
        "Docs rules",
        "</docs/AGENTS.md>",
      ].join("\n"),
    );
  });

  test("returns empty string when the file is missing", async () => {
    const adapter = await MemoryFileSystem.create();
    const loader = createAgentsMdLoader({ adapter });
    expect(await loader()).toBe("");
  });

  test("returns empty string when the file is blank", async () => {
    const adapter = await MemoryFileSystem.create({
      initialFiles: { "AGENTS.md": "   \n  " },
    });
    const loader = createAgentsMdLoader({ adapter });
    expect(await loader()).toBe("");
  });

  test("appends learn instructions when learn is true", async () => {
    const adapter = await MemoryFileSystem.create({
      initialFiles: { "AGENTS.md": "Agent rules here" },
    });
    const loader = createAgentsMdLoader({ adapter, learn: true });
    const result = await loader();

    expect(result).toContain("<AGENTS.md>\nAgent rules here\n</AGENTS.md>");
    expect(result).toContain("<learn>");
    expect(result).toContain("Automatically learn from this session.");
    expect(result).toContain("What NOT to include:");
    expect(result).toContain("</learn>");
  });

  test("returns learn instructions when the file is missing and learn is true", async () => {
    const adapter = await MemoryFileSystem.create();
    const loader = createAgentsMdLoader({ adapter, learn: true });
    const result = await loader();

    expect(result.startsWith("<learn>")).toBe(true);
    expect(result.endsWith("</learn>")).toBe(true);
    expect(result).not.toContain("<AGENTS.md>");
  });

  test("works with instructions middleware", async () => {
    const adapter = await MemoryFileSystem.create({
      initialFiles: { "AGENTS.md": "From AGENTS.md" },
    });
    const middleware = instructionsMiddleware({
      loaders: [createAgentsMdLoader({ adapter }), () => "Extra rules"],
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
          { role: "system", content: "stale" },
          {
            role: "user",
            content: [{ type: "text", text: "hi" }],
          },
        ],
      },
    });

    expect(result.prompt).toEqual([
      { role: "system", content: "stale" },
      {
        role: "system",
        content: [
          "The following instructions are loaded from AGENTS.md:",
          "",
          "<AGENTS.md>",
          "From AGENTS.md",
          "</AGENTS.md>",
        ].join("\n"),
      },
      { role: "system", content: "Extra rules" },
      {
        role: "user",
        content: [{ type: "text", text: "hi" }],
      },
    ]);
  });
});
