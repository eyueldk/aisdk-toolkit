import type { LanguageModelMiddleware } from "ai";

export type InstructionLoader = () => string | Promise<string>;

export type InstructionsMiddlewareOptions = {
  loaders: InstructionLoader[];
};

export function instructionsMiddleware(
  options: InstructionsMiddlewareOptions,
): LanguageModelMiddleware {
  return {
    specificationVersion: "v3",
    transformParams: async ({ params }) => {
      const injected: Array<{ role: "system"; content: string }> = [];

      for (const loader of options.loaders) {
        const text = await loader();
        const trimmed = text.trim();
        if (trimmed.length > 0) {
          injected.push({ role: "system", content: trimmed });
        }
      }

      if (injected.length === 0) {
        return params;
      }

      let lastSystemIndex = -1;
      for (let index = 0; index < params.prompt.length; index++) {
        if (params.prompt[index]?.role === "system") {
          lastSystemIndex = index;
        }
      }

      const insertAt = lastSystemIndex + 1;
      const prompt = [
        ...params.prompt.slice(0, insertAt),
        ...injected,
        ...params.prompt.slice(insertAt),
      ];

      return {
        ...params,
        prompt,
      };
    },
  };
}
