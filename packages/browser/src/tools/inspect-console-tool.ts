import { tool } from "ai";
import { z } from "zod";
import type { Session } from "../session";

export function createInspectConsoleTool({ session }: { session: Session }) {
  return tool({
    description: "Retrieve console logs from the current browsing session.",
    inputSchema: z.object({
      limit: z
        .number()
        .optional()
        .describe(
          "Maximum number of recent logs to retrieve. If not provided, returns all logs.",
        ),
    }),
    execute: async ({ limit }) => {
      const messages = session.consoleInspector.items;
      const messagesToReturn = limit ? messages.slice(-limit) : messages;
      const formattedLogs = messagesToReturn
        .map((msg) => {
          return `[${msg.type().toUpperCase()}] ${msg.text()}`;
        })
        .join("\n");
      const output = [`Console logs (${messagesToReturn.length} messages):`];
      output.push(formattedLogs || "(no logs)");
      return output.join("\n");
    },
  });
}
