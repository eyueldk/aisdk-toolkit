import { tool } from "ai";
import { z } from "zod";
import type { BrowserInstance } from "../browser/browser-instance";
import { getPageView } from "../utils";
import { ActiveTargetSchema, ViewAfterSchema } from "../schema";

export function createClickTool({ browser }: { browser: BrowserInstance }) {
  return tool({
    description:
      "Click an element on the active browser page using a CSS selector",
    inputSchema: z
      .object({
        cssSelector: z
          .string()
          .describe("The CSS selector for the element to click"),
        viewAfter: ViewAfterSchema,
      })
      .extend(ActiveTargetSchema.shape),
    execute: async ({ cssSelector, viewAfter, contextId, pageId }) =>
      browser.withPage(async (page) => {
        await page.click(cssSelector);
        const base = `Clicked element using CSS selector: ${cssSelector}`;
        const output: string[] = [base];
        if (viewAfter) {
          output.push(await getPageView(page, viewAfter.format));
        }
        return output.join("\n\n");
      }, { contextId, pageId }),
  });
}
