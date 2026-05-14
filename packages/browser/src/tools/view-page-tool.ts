import { tool } from "ai";
import { z } from "zod";
import type { Session } from "../session";
import { getView } from "../utils";

export function createViewPageTool({ session }: { session: Session }) {
  return tool({
    description:
      "View the current browsing session in a simplified form only containing 'interesting' elements.",
    inputSchema: z.object({}),
    execute: async () => {
      const output = await getView(session.page);
      return output;
    },
  });
}
