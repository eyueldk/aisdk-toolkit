import { describe, test, expect, beforeAll, afterAll } from "vitest";
import puppeteer, { type Browser, type Page } from "puppeteer";
import { createBrowserTools, Session } from "../src/index";

const toolOpts = { toolCallId: "test", messages: [] } as const;

describe("Browser Tools Integration Tests", () => {
  let browser: Browser;
  let page: Page;
  let session: Session;
  let tools: ReturnType<typeof createBrowserTools>;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    page = await browser.newPage();
    session = new Session({ page });
    tools = createBrowserTools({ session });
  });

  afterAll(async () => {
    session.close();
    await browser.close();
  });

  test("goto tool should navigate to a URL", async () => {
    const result = await tools.goto.execute!(
      { url: "https://example.com" },
      { ...toolOpts, messages: [] },
    );

    expect(typeof result).toBe("string");
    expect((result as string).length).toBeGreaterThan(0);
    const url = page.url();
    expect(url).toBe("https://example.com/");
  });

  test("inspectHTML tool should return HTML content", async () => {
    const result = await tools.inspectHTML.execute!(
      { cssSelector: "h1" },
      { ...toolOpts, messages: [] },
    );

    expect(typeof result).toBe("string");
    expect((result as string).length).toBeGreaterThan(0);
  });

  test("evaluate tool should execute JavaScript", async () => {
    const result = await tools.evaluate.execute!(
      { script: "1 + 1" },
      { ...toolOpts, messages: [] },
    );

    expect(typeof result).toBe("string");
    expect((result as string).length).toBeGreaterThan(0);
  });

  test("type tool should type text into an input", async () => {
    await page.setContent(`
      <html>
        <body>
          <input id="test-input" type="text" />
        </body>
      </html>
    `);

    const result = await tools.type.execute!(
      {
        cssSelector: "#test-input",
        text: "Hello World",
      },
      { ...toolOpts, messages: [] },
    );

    expect(typeof result).toBe("string");
    expect((result as string).length).toBeGreaterThan(0);

    const inputValue = await page.$eval(
      "#test-input",
      (el) => (el as HTMLInputElement).value,
    );
    expect(inputValue).toBe("Hello World");
  });

  test("click tool should click an element", async () => {
    await page.setContent(`
      <html>
        <body>
          <button id="test-button" onclick="document.body.style.backgroundColor = 'red'">Click Me</button>
        </body>
      </html>
    `);

    const result = await tools.click.execute!(
      { cssSelector: "#test-button" },
      { ...toolOpts, messages: [] },
    );

    expect(typeof result).toBe("string");
    expect((result as string).length).toBeGreaterThan(0);

    const bgColor = await page.evaluate(
      () => document.body.style.backgroundColor,
    );
    expect(bgColor).toBe("red");
  });

  test("getScreenshot tool should return base64 JPEG data", async () => {
    const result = await tools.getScreenshot.execute!(
      {},
      { ...toolOpts, messages: [] },
    );

    expect(typeof result).toBe("string");
    expect((result as string).length).toBeGreaterThan(0);
  });

  test("viewPage tool should return simplified page content", async () => {
    await page.setContent(`
      <html>
        <body>
          <h1>Test Title</h1>
          <p>Test Paragraph</p>
          <a href="#">Test Link</a>
        </body>
      </html>
    `);

    const result = await tools.viewPage.execute!(
      {},
      { ...toolOpts, messages: [] },
    );

    expect(typeof result).toBe("string");
    expect((result as string).length).toBeGreaterThan(0);
  });
});
