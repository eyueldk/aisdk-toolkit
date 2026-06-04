import { tool } from "ai";
import { z } from "zod";
import type { BrowserInstance } from "../browser/browser-instance";
import { ActiveTargetSchema } from "../schema";

export function createInspectHTMLTool({ browser }: { browser: BrowserInstance }) {
  return tool({
    description:
      "Return HTML for the full active page or a slice matched by a CSS selector",
    inputSchema: z
      .object({
        cssSelector: z
          .string()
          .optional()
          .describe(
            "Optional CSS selector. If omitted, returns the full page HTML.",
          ),
      })
      .extend(ActiveTargetSchema.shape),
    execute: async ({ cssSelector, contextId, pageId }) =>
      browser.withPage(async (page) => {
        if (!cssSelector) {
          return await page.content();
        }
        return page.locator(cssSelector).evaluate((el) => el.outerHTML);
      }, { contextId, pageId }),
  });
}
