import type { Session } from "./session";
import { createGotoTool } from "./tools/goto-tool";
import { createClickTool } from "./tools/click-tool";
import { createEvaluateTool } from "./tools/evaluate-tool";
import { createGetCookiesTool } from "./tools/get-cookies-tool";
import { createInspectHTMLTool } from "./tools/inspect-html-tool";
import { createGetScreenshotTool } from "./tools/get-screenshot-tool";
import { createInspectConsoleTool } from "./tools/inspect-console-tool";
import { createInspectNetworkTool } from "./tools/inspect-network-tool";
import { createTypeTool } from "./tools/type-tool";
import { createViewPageTool } from "./tools/view-page-tool";

/**
 * Builds browser {@link https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling tools}
 * for the Vercel AI SDK (`generateText`, `streamText`, `ToolLoopAgent`, etc.) from a {@link Session}.
 * Inspectors are already active on the session from construction.
 */
export function createBrowserTools({ session }: { session: Session }) {
  const tools = {
    goto: createGotoTool({ session }),
    click: createClickTool({ session }),
    type: createTypeTool({ session }),
    evaluate: createEvaluateTool({ session }),
    inspectConsole: createInspectConsoleTool({ session }),
    getCookies: createGetCookiesTool({ session }),
    viewPage: createViewPageTool({ session }),
    inspectHTML: createInspectHTMLTool({ session }),
    getScreenshot: createGetScreenshotTool({ session }),
    inspectNetwork: createInspectNetworkTool({ session }),
  };
  return { ...tools } as const;
}
