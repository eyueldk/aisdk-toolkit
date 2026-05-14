import { tool } from "ai";
import { z } from "zod";
import type { Session } from "../session";

export function createGetCookiesTool({ session }: { session: Session }) {
  return tool({
    description: "Return cookies for the current session as a JSON string",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const page = session.page;
        const ctx = page.browserContext();
        const cookies = await ctx.cookies();
        return JSON.stringify(cookies);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return `Error getting cookies: ${errorMessage}`;
      }
    },
  });
}
