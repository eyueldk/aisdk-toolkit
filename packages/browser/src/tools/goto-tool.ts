import { tool } from "ai";
import { z } from "zod";
import type { BrowserInstance } from "../browser/browser-instance";
import { getPageView } from "../utils";
import { ActiveTargetSchema, ViewAfterSchema } from "../schema";

export function createGotoTool({ browser }: { browser: BrowserInstance }) {
  return tool({
    description: "Navigate to a URL in the active browser page",
    inputSchema: z
      .object({
        url: z.string().describe("The URL to navigate to"),
        viewAfter: ViewAfterSchema,
      })
      .extend(ActiveTargetSchema.shape),
    execute: async ({ url, viewAfter, contextId, pageId }) =>
      browser.withPage(async (page) => {
        await page.goto(url, { waitUntil: "load" });
        const base = `Navigated to URL: ${url}`;
        const output: string[] = [base];
        if (viewAfter) {
          output.push(await getPageView(page, viewAfter.format));
        }
        return output.join("\n\n");
      }, { contextId, pageId }),
  });
}
