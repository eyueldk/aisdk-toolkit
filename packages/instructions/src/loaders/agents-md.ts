import type { FileSystemAdapter } from "@eyueldk/aisdk-toolkit-filesystem";
import type { InstructionLoader } from "../middleware";

export type AgentsMdLoaderOptions = {
  adapter: FileSystemAdapter;
  path?: string;
  /** When true, instruct the agent to learn from the session and update AGENTS.md when required. */
  learn?: boolean;
};

export function createAgentsMdLoader(
  options: AgentsMdLoaderOptions,
): InstructionLoader {
  const filePath = options.path ?? "AGENTS.md";
  const learn = options.learn ?? false;

  return async () => {
    const parts: string[] = [];
    const contents = await readAgentsMd(options.adapter, filePath);
    if (contents.length > 0) {
      parts.push(formatAgentsMdInstructions(filePath, contents));
    }
    if (learn) {
      parts.push(AGENTS_MD_LEARN_INSTRUCTIONS);
    }
    return parts.join("\n\n");
  };
}

async function readAgentsMd(
  adapter: FileSystemAdapter,
  path: string,
): Promise<string> {
  try {
    const contents = await adapter.readFile(path, { encoding: "utf8" });
    return contents.trim();
  } catch (error) {
    if (isMissingFileError(error)) {
      return "";
    }
    throw error;
  }
}

function formatAgentsMdInstructions(path: string, contents: string): string {
  return `The following instructions are loaded from ${path}:

<${path}>
${contents}
</${path}>`;
}

function isMissingFileError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  if ("code" in error && error.code === "ENOENT") {
    return true;
  }

  if ("message" in error && typeof error.message === "string") {
    return /ENOENT|no such file/i.test(error.message);
  }

  return false;
}

const AGENTS_MD_LEARN_INSTRUCTIONS = `<learn>
Automatically learn from this session. When you discover durable, non-obvious insights, update AGENTS.md at the appropriate directory level.

AGENTS.md files can exist at any directory level, not just the project root. Place learnings as close to the relevant code as possible:
- Project-wide learnings → root AGENTS.md
- Package/module-specific → packages/foo/AGENTS.md
- Feature-specific → src/auth/AGENTS.md

What counts as a learning (non-obvious discoveries only):
- Hidden relationships between files or modules
- Execution paths that differ from how code appears
- Non-obvious configuration, env vars, or flags
- Debugging breakthroughs when error messages were misleading
- API/tool quirks and workarounds
- Build/test commands not in README
- Architectural decisions and constraints
- Files that must change together

What NOT to include:
- Obvious facts from documentation
- Standard language/framework behavior
- Things already in an AGENTS.md
- Verbose explanations
- Session-specific details

Process:
1. Review the session for discoveries, errors that took multiple attempts, and unexpected connections
2. Determine scope — what directory does each learning apply to?
3. Read existing AGENTS.md files at relevant levels
4. Create or update AGENTS.md at the appropriate level
5. Keep entries to 1-3 lines per insight

After updating, summarize which AGENTS.md files were created or updated and how many learnings per file.
</learn>`;
