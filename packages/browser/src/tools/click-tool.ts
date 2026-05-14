import { tool } from "ai";
import { z } from "zod";
import type { Session } from "../session";
import { getView } from "../utils";

export function createClickTool({ session }: { session: Session }) {
  return tool({
    description:
      "Click an element in the current browsing session using a CSS selector",
    inputSchema: z.object({
      cssSelector: z
        .string()
        .describe("The CSS selector for the element to click"),
      viewAfter: z
        .boolean()
        .optional()
        .describe("If true, return a simplified view after clicking"),
    }),
    execute: async ({ cssSelector, viewAfter }) => {
      try {
        await session.page.click(cssSelector);

        const base = `Clicked element using CSS selector: ${cssSelector}`;
        const output: string[] = [base];
        if (viewAfter) {
          output.push(await getView(session.page));
        }
        return output.join("\n\n");
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return `Error clicking element ${cssSelector}: ${errorMessage}`;
      }
    },
  });
}
