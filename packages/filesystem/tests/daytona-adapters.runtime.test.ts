import type { Sandbox } from "@daytonaio/sdk";
import { Readable } from "node:stream";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DaytonaFileSystem } from "../src/adapters/daytona-adapter";

function mockSandbox(fs: {
  downloadFile: ReturnType<typeof vi.fn>;
  downloadFileStream: ReturnType<typeof vi.fn>;
}): Sandbox {
  return { fs } as unknown as Sandbox;
}

describe("DaytonaFileSystem serverless/browser read path", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("uses downloadFile when WebSocketPair indicates Cloudflare Workers", async () => {
    vi.stubGlobal("WebSocketPair", function WebSocketPair() {});

    const downloadFile = vi
      .fn()
      .mockResolvedValue(Buffer.from("buffered", "utf8"));
    const downloadFileStream = vi.fn();
    const adapter = await DaytonaFileSystem.create({
      sandbox: mockSandbox({ downloadFile, downloadFileStream }),
      root: "workspace",
    });

    expect(await adapter.readFile("hello.txt", { encoding: "utf8" })).toBe(
      "buffered",
    );
    expect(downloadFile).toHaveBeenCalledWith("workspace/hello.txt");
    expect(downloadFileStream).not.toHaveBeenCalled();
  });

  test("uses downloadFileStream on Node when streams are supported", async () => {
    const downloadFile = vi.fn();
    const downloadFileStream = vi
      .fn()
      .mockResolvedValue(Readable.from(Buffer.from("streamed", "utf8")));
    const adapter = await DaytonaFileSystem.create({
      sandbox: mockSandbox({ downloadFile, downloadFileStream }),
      root: "workspace",
    });

    expect(await adapter.readFile("hello.txt", { encoding: "utf8" })).toBe(
      "streamed",
    );
    expect(downloadFileStream).toHaveBeenCalledWith("workspace/hello.txt");
    expect(downloadFile).not.toHaveBeenCalled();
  });
});
