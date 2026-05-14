import { tool } from "ai";
import { z } from "zod";
import type { Session } from "../session";

export function createInspectHTMLTool({ session }: { session: Session }) {
  return tool({
    description:
      "Inspect the outer HTML of a specific element. If a selector is not provided, the outer HTML of the entire page will be returned.",
    inputSchema: z.object({
      cssSelector: z
        .string()
        .optional()
        .describe("The CSS selector for the element"),
    }),
    execute: async ({ cssSelector }) => {
      try {
        if (!cssSelector) {
          return await session.page.content();
        }
        return await session.page.$eval(
          cssSelector,
          (element) => element?.outerHTML,
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return `Error occurred getting outer html of "${String(cssSelector)}": ${errorMessage}`;
      }
    },
  });
}
