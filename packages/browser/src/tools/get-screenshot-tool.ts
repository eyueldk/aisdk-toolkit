import { tool } from "ai";
import { z } from "zod";
import type { Session } from "../session";

export function createGetScreenshotTool({ session }: { session: Session }) {
  return tool({
    description: "Take a screenshot of the current browsing session",
    inputSchema: z.object({}),
    execute: async () => {
      const screenshot = await session.page.screenshot({
        type: "jpeg",
        quality: 50,
      });
      return Buffer.from(screenshot).toString("base64");
    },
    toModelOutput: async ({ output }) => ({
      type: "content",
      value: [
        { type: "text", text: "Screenshot captured (JPEG)." },
        {
          type: "image-data",
          data: output,
          mediaType: "image/jpeg",
        },
      ],
    }),
  });
}
