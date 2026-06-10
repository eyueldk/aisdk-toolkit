import { describe, expect, test } from "vitest";
import { htmlToMarkdown } from "../src/html-to-markdown";

describe("htmlToMarkdown", () => {
  test("converts headings and links", () => {
    const md = htmlToMarkdown(
      '<!DOCTYPE html><html><body><h2>Title</h2><p>Read <a href="https://example.com">docs</a>.</p></body></html>',
    );
    expect(md).toContain("## Title");
    expect(md).toContain("[docs](https://example.com)");
  });

  test("converts GFM tables", () => {
    const md = htmlToMarkdown(
      "<!DOCTYPE html><html><body><table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table></body></html>",
    );
    expect(md).toMatch(/\| A\s+\| B\s+\|/);
    expect(md).toMatch(/\| 1\s+\| 2\s+\|/);
  });
});
