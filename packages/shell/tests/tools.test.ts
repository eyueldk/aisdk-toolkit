import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  LocalShell,
  SHELL_HINT,
  createShellToolkit,
} from "../src/index";

const toolOpts = { toolCallId: "test", messages: [] } as const;

describe("createShellToolkit", () => {
  test("returns tools, hint, and state", async () => {
    const adapter = await LocalShell.create();
    const kit = createShellToolkit({ adapter });
    expect(kit.tools.executeCommand).toBeDefined();
    expect(kit.hint).toBe(SHELL_HINT);
    expect(kit.state.adapter).toBe(adapter);
  });

  test("executeCommand formats adapter output", async () => {
    const adapter = await LocalShell.create();
    const { executeCommand } = createShellToolkit({ adapter }).tools;
    const out = await executeCommand.execute!(
      { command: "echo hi" },
      { ...toolOpts, messages: [] },
    );
    expect(typeof out).toBe("string");
    expect(out).toContain("Exit code: 0");
    expect(out).toContain("hi");
  });

  test("executeCommand cwd selects working directory", async () => {
    const workDir = mkdtempSync(join(tmpdir(), "aisdk-shell-cwd-"));
    const adapter = await LocalShell.create();
    const { executeCommand } = createShellToolkit({ adapter }).tools;
    const out = await executeCommand.execute!(
      { command: "node -p \"process.cwd()\"", cwd: workDir },
      { ...toolOpts, messages: [] },
    );
    expect(out).toContain(workDir);
  });
});
