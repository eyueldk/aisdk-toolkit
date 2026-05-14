import "dotenv/config";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, stepCountIs } from "ai";
import puppeteer, { type Browser } from "puppeteer";
import { afterAll, describe, expect, test } from "vitest";
import { createBrowserTools, Session } from "../src/index";

const hasOpenRouterKey =
  typeof process.env.OPENROUTER_API_KEY === "string" &&
  process.env.OPENROUTER_API_KEY.trim().length > 0;

const OPENROUTER_MODEL = "google/gemini-2.5-flash-lite";

describe.skipIf(!hasOpenRouterKey)("Agent with browser tools", () => {
  let browser: Browser | undefined;
  let session: Session | undefined;

  afterAll(async () => {
    session?.close();
    await browser?.close();
  });

  test(
    "uses browser tools to open example.com",
    async () => {
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      const page = await browser.newPage();
      session = new Session({ page });
      const tools = createBrowserTools({ session });

      const openrouter = createOpenRouter({
        apiKey: process.env.OPENROUTER_API_KEY!,
        appName: "@aitoolkit/browser",
      });

      const result = await generateText({
        model: openrouter.chat(OPENROUTER_MODEL),
        tools,
        stopWhen: stepCountIs(15),
        prompt: `Use the goto tool to open https://example.com in the browser.
Then briefly describe what you see on the page in your final answer.`,
      });

      expect(result.text?.length ?? 0).toBeGreaterThan(0);
      expect(page.url()).toMatch(/example\.com/i);

      const heading = await page.$eval("h1", (el) => el.textContent?.trim() ?? "");
      expect(heading).toBe("Example Domain");
    },
    120_000,
  );
});
