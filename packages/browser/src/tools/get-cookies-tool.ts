import { tool } from "ai";
import { z } from "zod";
import type { BrowserInstance } from "../browser/browser-instance";
import { ActiveTargetSchema } from "../schema";

export function createGetCookiesTool({ browser }: { browser: BrowserInstance }) {
  return tool({
    description: "Return cookies for the active page's browser context",
    inputSchema: ActiveTargetSchema,
    execute: async ({ contextId, pageId }) =>
      browser.withPage(async (page) => {
        const cookies = await page.context().cookies();
        return JSON.stringify(cookies);
      }, { contextId, pageId }),
  });
}
