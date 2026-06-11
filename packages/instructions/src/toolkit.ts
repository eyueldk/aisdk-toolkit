import type { LanguageModelMiddleware } from "ai";
import {
  instructionsMiddleware,
  type InstructionLoader,
} from "./middleware";

export type InstructionsToolkit = {
  middleware: LanguageModelMiddleware;
};

export type CreateInstructionsToolkitOptions = {
  loaders: InstructionLoader[];
};

/**
 * Primary entry point: AI SDK **`middleware`** that loads instructions from **`loaders`**
 * on every model call.
 */
export function createInstructionsToolkit(
  options: CreateInstructionsToolkitOptions,
): InstructionsToolkit {
  return {
    middleware: instructionsMiddleware({
      loaders: options.loaders,
    }),
  };
}
