import { tool } from "ai";
import { z } from "zod";
import type { Session } from "../session";
import { getView } from "../utils";

export function createTypeTool({ session }: { session: Session }) {
  return tool({
    description:
      "Type text into an input element in the current browsing session using a CSS selector",
    inputSchema: z.object({
      cssSelector: z
        .string()
        .describe("The CSS selector for the input element"),
      text: z.string().describe("Text to type"),
      viewAfter: z
        .boolean()
        .optional()
        .describe("If true, return a simplified view after typing"),
    }),
    execute: async ({ cssSelector, text, viewAfter }) => {
      try {
        await session.page.waitForSelector(cssSelector);
        await session.page.type(cssSelector, text);
        const base = `Typed text into CSS selector: ${cssSelector}`;
        const output: string[] = [base];
        if (viewAfter) {
          output.push(await getView(session.page));
        }
        return output.join("\n\n");
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return `Error typing into ${cssSelector}: ${errorMessage}`;
      }
    },
  });
}
