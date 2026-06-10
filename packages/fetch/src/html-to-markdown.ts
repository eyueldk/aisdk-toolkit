import { DOMParser } from "linkedom";
import TurndownService from "turndown";
import { gfm } from "@truto/turndown-plugin-gfm";

export function htmlToMarkdown(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) {
    return "";
  }
  const document = domParser.parseFromString(trimmed, "text/html");
  const { body } = document;
  const elements = topLevelElements(body);

  const [onlyElement] = elements;
  // linkedom + turndown + GFM: turndown(body) returns "" for table-only pages.
  if (elements.length === 1 && onlyElement?.nodeName === "TABLE") {
    return turndownService.turndown(onlyElement).trim();
  }

  const markdown = turndownService.turndown(body).trim();
  if (markdown) {
    return markdown;
  }

  // Same quirk for other body shapes; convert each top-level element separately.
  const parts = elements
    .map((element) => turndownService.turndown(element).trim())
    .filter((part) => part.length > 0);
  return parts.join("\n\n");
}

export function isHtmlResponseBody(
  headers: Record<string, string>,
  body: string,
): boolean {
  const contentType = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === "content-type",
  )?.[1];
  if (contentType?.toLowerCase().includes("html")) {
    return true;
  }
  const trimmed = body.trimStart();
  return trimmed.startsWith("<") && /<\/[a-z][\s\S]*>/i.test(trimmed);
}

const domParser = new DOMParser();

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  emDelimiter: "_",
});
turndownService.use(gfm);

const ELEMENT_NODE = 1;

type HtmlElement = {
  nodeType: number;
  nodeName: string;
};

function topLevelElements(body: { childNodes: Iterable<HtmlElement> }) {
  const elements: HtmlElement[] = [];
  for (const child of body.childNodes) {
    if (child.nodeType === ELEMENT_NODE) {
      elements.push(child);
    }
  }
  return elements;
}
