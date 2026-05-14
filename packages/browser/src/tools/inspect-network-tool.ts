import { tool } from "ai";
import { z } from "zod";
import type { Session } from "../session";

const ResourceTypeEnum = z.enum([
  "document",
  "stylesheet",
  "image",
  "media",
  "font",
  "script",
  "texttrack",
  "xhr",
  "fetch",
  "prefetch",
  "eventsource",
  "websocket",
  "manifest",
  "signedexchange",
  "ping",
  "cspviolationreport",
  "preflight",
  "fedcm",
  "other",
]);

export function createInspectNetworkTool({ session }: { session: Session }) {
  return tool({
    description:
      "Inspect network logs of the current session. Optionally filter by an array of lower-case resource types (see schema). If omitted, returns all resource types.",
    inputSchema: z.object({
      limit: z
        .number()
        .optional()
        .describe(
          "Maximum number of recent network logs to retrieve. If not provided, returns all logs.",
        ),
      resourceTypes: z
        .array(ResourceTypeEnum)
        .optional()
        .describe(
          "Array of lower-case resource types (puppeteer values). If omitted, returns all resource types.",
        ),
    }),
    execute: async ({ limit, resourceTypes }) => {
      const allowed =
        resourceTypes == null ? null : new Set<string>(resourceTypes);
      const entries = session.networkInspector.items
        .filter((e) => {
          return allowed === null || allowed.has(e.resourceType);
        })
        .slice(limit === undefined ? undefined : -limit);
      return JSON.stringify(entries, null, 2);
    },
  });
}
