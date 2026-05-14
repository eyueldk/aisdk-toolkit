import type { Page } from "puppeteer-core";

export async function getView(page: Page) {
  return [
    `## URL: ${page.url()}`,
    `## Title: ${await page.title()}`,
    `## Fetched At: ${new Date().toISOString()}`,
    "\n",
    await getSimplifiedHtml({ page }),
  ].join("\n");
}

export async function getSimplifiedHtml({
  page,
}: {
  page: Page;
}): Promise<string> {
  return page.evaluate(() => {
    const interestingAttributeNames = new Set([
      "id",
      "name",
      "role",
      "href",
      "class",
      "value",
      "placeholder",
    ]);
    function isInterestingAttribute(name: string): boolean {
      const lower = name.toLowerCase();
      return (
        interestingAttributeNames.has(lower) ||
        lower.startsWith("data-") ||
        lower.startsWith("aria-")
      );
    }

    const ignoreDirectTextTags = new Set(["script", "style", "noscript"]);
    function hasDirectText(element: Element): boolean {
      const tag = element.tagName.toLowerCase();
      if (ignoreDirectTextTags.has(tag)) return false;
      return Array.from(element.childNodes).some(
        (child) =>
          child.nodeType === Node.TEXT_NODE &&
          (child.textContent?.trim().length ?? 0) > 0,
      );
    }

    const tableTags = new Set([
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "th",
      "td",
      "caption",
    ]);
    function isTableTag(node: Element): boolean {
      return tableTags.has(node.tagName.toLowerCase());
    }

    const interactiveTags = new Set([
      "button",
      "input",
      "textarea",
      "select",
      "a",
      "label",
      "option",
      "datalist",
    ]);
    const interactiveRoles = new Set([
      "button",
      "link",
      "textbox",
      "checkbox",
      "radio",
      "combobox",
      "grid",
      "gridcell",
      "columnheader",
      "row",
      "rowheader",
    ]);
    function isInteractive(node: Element): boolean {
      const tag = node.tagName.toLowerCase();
      if (interactiveTags.has(tag)) return true;
      if (node.hasAttribute("onclick")) return true;
      const role = node.getAttribute("role");
      if (role && interactiveRoles.has(role.toLowerCase())) return true;
      return false;
    }

    function isVisualElement(element: Element): boolean {
      const tag = element.tagName.toLowerCase();
      if (tag === "img" || tag === "svg") return true;
      const style = window.getComputedStyle(element);
      const bgImage = style.backgroundImage;
      if (bgImage && bgImage !== "none") return true;
      return false;
    }

    function isInterestingElement(element: Element): boolean {
      if (isTableTag(element)) return true;
      if (hasDirectText(element)) return true;
      if (isInteractive(element)) return true;
      if (isVisualElement(element)) return true;
      return false;
    }

    function render(element: Element): string | undefined {
      const tag = element.tagName.toLowerCase();
      const children = Array.from(element.children);
      const attrs = Array.from(element.attributes).filter((attr) =>
        isInterestingAttribute(attr.name),
      );
      const attrsStr = attrs
        .map((attr) => ` ${attr.name}="${attr.value}"`)
        .join("");
      if (isInterestingElement(element)) {
        return element.outerHTML;
      } else {
        const childrenRendered = children
          .map((child) => render(child))
          .filter(Boolean)
          .join("");
        if (!childrenRendered) {
          return;
        } else {
          return `<${tag}${attrsStr}>${childrenRendered || "..."}</${tag}>`;
        }
      }
    }

    const clone = document.cloneNode(true) as Document;
    clone
      .querySelectorAll("script, style, noscript, link")
      .forEach((el) => el.remove());
    clone.querySelectorAll("*").forEach((element) => {
      Array.from(element.childNodes).forEach((child) => {
        if (child.nodeType === Node.COMMENT_NODE) {
          child.remove();
        }
      });
      Array.from(element.attributes).forEach((attribute) => {
        if (!isInterestingAttribute(attribute.name)) {
          element.removeAttribute(attribute.name);
        }
      });
    });
    return render(clone.documentElement) ?? "[EMPTY]";
  });
}
