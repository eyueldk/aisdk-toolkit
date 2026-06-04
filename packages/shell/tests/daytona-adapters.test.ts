import { Daytona } from "@daytonaio/sdk";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { DaytonaShell } from "../src/index";
import { SH_DUAL_STREAM_CMD } from "./stream-output.helpers";

const hasDaytonaKey = Boolean(process.env.DAYTONA_API_KEY?.trim());

describe("DaytonaShell", () => {
  let daytona: Daytona;
  let sandbox: Awaited<ReturnType<Daytona["create"]>>;
  let ready = false;

  beforeAll(async () => {
    if (!hasDaytonaKey) return;
    try {
      daytona = new Daytona();
      sandbox = await daytona.create();
      const probe = await sandbox.process.executeCommand("echo ok");
      ready = probe.exitCode === 0;
    } catch {
      ready = false;
    }
  }, 180_000);

  afterAll(async () => {
    if (ready) await sandbox.delete();
  }, 60_000);

  test.skipIf(!ready)("runs a command in the sandbox", async () => {
    const shell = await DaytonaShell.create({ sandbox, cwd: "workspace" });
    const result = await shell.exec('echo "from-daytona"');
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("from-daytona");
  });

  test.skipIf(!ready)(
    "exec returns stdout only (Daytona API has no separate stderr)",
    async () => {
      const shell = await DaytonaShell.create({ sandbox, cwd: "workspace" });
      const result = await shell.exec(SH_DUAL_STREAM_CMD);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("stdout-msg");
      expect(result.stderr).toBe("");
    },
  );
});
