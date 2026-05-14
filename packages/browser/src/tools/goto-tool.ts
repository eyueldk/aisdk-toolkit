import { tool } from "ai";
import { z } from "zod";
import type { Session } from "../session";
import { getView } from "../utils";

export function createGotoTool({ session }: { session: Session }) {
  return tool({
    description: "Navigate to a URL in the current browsing session",
    inputSchema: z.object({
      url: z.string().describe("The URL to navigate to"),
      viewAfter: z
        .boolean()
        .optional()
        .describe("If true, return a simplified view after navigating"),
    }),
    execute: async ({ url, viewAfter }) => {
      try {
        await session.page.goto(url, { waitUntil: "networkidle2" });
        const base = `Navigated to URL: ${url}`;
        const output: string[] = [base];
        if (viewAfter) {
          output.push(await getView(session.page));
        }
        return output.join("\n\n");
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return `Error navigating to ${url}: ${errorMessage}`;
      }
    },
  });
}
