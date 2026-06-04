import { tool } from "ai";
import { z } from "zod";
import type { BrowserInstance } from "../browser/browser-instance";
import { getPageView } from "../utils";
import { ActiveTargetSchema, ViewAfterSchema } from "../schema";

export function createTypeTool({ browser }: { browser: BrowserInstance }) {
  return tool({
    description:
      "Type text into an input element on the active page using a CSS selector",
    inputSchema: z
      .object({
        cssSelector: z
          .string()
          .describe("The CSS selector for the input element"),
        text: z.string().describe("Text to type"),
        viewAfter: ViewAfterSchema,
      })
      .extend(ActiveTargetSchema.shape),
    execute: async ({ cssSelector, text, viewAfter, contextId, pageId }) =>
      browser.withPage(async (page) => {
        await page.locator(cssSelector).waitFor({ state: "visible" });
        await page.fill(cssSelector, text);
        const base = `Typed text into CSS selector: ${cssSelector}`;
        const output: string[] = [base];
        if (viewAfter) {
          output.push(await getPageView(page, viewAfter.format));
        }
        return output.join("\n\n");
      }, { contextId, pageId }),
  });
}
