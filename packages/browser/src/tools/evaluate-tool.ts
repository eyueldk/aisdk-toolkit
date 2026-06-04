import { tool } from "ai";
import { z } from "zod";
import type { BrowserInstance } from "../browser/browser-instance";
import { getPageView } from "../utils";
import { ActiveTargetSchema, ViewAfterSchema } from "../schema";

const EVALUATE_DESCRIPTION =
  "Run JavaScript in the active page via Playwright evaluate (expression or statements). Prefer inspectHTML for DOM markup. Returns a structured result value.";

const EvaluateOutputSchema = z.object({
  value: z
    .unknown()
    .optional()
    .describe("Return value when the script produced one (JSON-serializable)"),
  undefined: z
    .literal(true)
    .optional()
    .describe("Present when the script returned no value (undefined)"),
  view: z
    .string()
    .optional()
    .describe("Page snapshot when viewAfter was requested"),
});

export function createEvaluateTool({ browser }: { browser: BrowserInstance }) {
  return tool({
    description: EVALUATE_DESCRIPTION,
    inputSchema: z
      .object({
        script: z
          .string()
          .describe(
            "JavaScript to run in the page (Playwright evaluate — expression or statements).",
          ),
        viewAfter: ViewAfterSchema,
      })
      .extend(ActiveTargetSchema.shape),
    outputSchema: EvaluateOutputSchema,
    execute: async ({ script, viewAfter, contextId, pageId }) =>
      browser.withPage(async (page) => {
        const result = await page.evaluate(script);
        const output = formatEvaluateResult(result);
        if (viewAfter) {
          output.view = await getPageView(page, viewAfter.format);
        }
        return output;
      }, { contextId, pageId }),
  });
}

export { EVALUATE_DESCRIPTION };

function formatEvaluateResult(result: unknown): z.infer<typeof EvaluateOutputSchema> {
  if (result === undefined) {
    return {
      undefined: true,
    };
  }
  return { value: result };
}
