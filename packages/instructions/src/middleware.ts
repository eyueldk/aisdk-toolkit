import type { LanguageModelMiddleware } from "ai";

export type InstructionLoader = () => string | Promise<string>;

export type InstructionsMiddlewareOptions = {
  loaders: InstructionLoader[];
  separator?: string;
};

export function instructionsMiddleware(
  options: InstructionsMiddlewareOptions,
): LanguageModelMiddleware {
  const separator = options.separator ?? "\n\n";
  return {
    specificationVersion: "v3",
    transformParams: async ({ params }) => {
      const conversation = params.prompt.filter(
        (message) => message.role !== "system",
      );
      const parts: string[] = [];

      for (const loader of options.loaders) {
        const text = await loader();
        const trimmed = text.trim();
        if (trimmed.length > 0) {
          parts.push(trimmed);
        }
      }

      const systemContent = parts.join(separator);
      const prompt =
        systemContent.length > 0
          ? [{ role: "system" as const, content: systemContent }, ...conversation]
          : conversation;

      return {
        ...params,
        prompt,
      };
    },
  };
}
