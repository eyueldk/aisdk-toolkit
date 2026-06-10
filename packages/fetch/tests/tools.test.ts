import { describe, expect, test } from "vitest";
import {
  DEFAULT_FETCH_TIMEOUT_MS,
  fetchPrompt,
  buildRequestUrl,
  createFetchToolkit,
} from "../src/index";

const toolOpts = { toolCallId: "test", messages: [] } as const;

describe("createFetchToolkit", () => {
  test("returns tools, prompt, and state with native fetch by default", () => {
    const kit = createFetchToolkit();
    expect(kit.tools.fetchRequest).toBeDefined();
    expect(kit.prompt()).toBe(fetchPrompt({ defaultTimeoutMs: kit.state.defaultTimeoutMs }));
    expect(kit.state.fetch).toBe(globalThis.fetch);
    expect(kit.state.defaultTimeoutMs).toBe(DEFAULT_FETCH_TIMEOUT_MS);
  });

  test("fetchRequest formats response output", async () => {
    const kit = createFetchToolkit({
      fetch: async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          statusText: "OK",
          headers: { "content-type": "application/json" },
        }),
    });
    const out = await kit.tools.fetchRequest.execute!(
      { path: "https://example.com/api" },
      { ...toolOpts, messages: [] },
    );
    expect(typeof out).toBe("string");
    expect(out).toContain("Status: 200 OK");
    expect(out).toContain('{"ok":true}');
    expect(out).toContain("content-type: application/json");
  });

  test("fetchRequest passes method, headers, and body", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit = {};
    const kit = createFetchToolkit({
      fetch: async (url, init) => {
        capturedUrl = String(url);
        capturedInit = init ?? {};
        return new Response("created", { status: 201, statusText: "Created" });
      },
    });
    await kit.tools.fetchRequest.execute!(
      {
        path: "https://example.com/items",
        method: "POST",
        headers: { "content-type": "application/json" },
        body: '{"name":"a"}',
      },
      { ...toolOpts, messages: [] },
    );
    expect(capturedUrl).toBe("https://example.com/items");
    expect(capturedInit.method).toBe("POST");
    expect(capturedInit.headers).toEqual({
      "content-type": "application/json",
    });
    expect(capturedInit.body).toBe('{"name":"a"}');
  });

  test("buildRequestUrl merges query params", () => {
    expect(
      buildRequestUrl("https://example.com/search", { q: "cats", page: 2 }),
    ).toBe("https://example.com/search?q=cats&page=2");
    expect(
      buildRequestUrl("https://example.com/search?sort=desc", { q: "cats" }),
    ).toBe("https://example.com/search?sort=desc&q=cats");
  });

  test("fetchRequest builds URL from path and query", async () => {
    let capturedUrl = "";
    const kit = createFetchToolkit({
      fetch: async (url) => {
        capturedUrl = String(url);
        return new Response("ok", { status: 200, statusText: "OK" });
      },
    });
    await kit.tools.fetchRequest.execute!(
      {
        path: "https://example.com/api",
        query: { limit: 10, active: true },
      },
      { ...toolOpts, messages: [] },
    );
    expect(capturedUrl).toBe("https://example.com/api?limit=10&active=true");
  });

  test("fetchRequest markdown converts HTML response bodies", async () => {
    const kit = createFetchToolkit({
      fetch: async () =>
        new Response(
          "<!DOCTYPE html><html><body><h1>Page</h1><p>Hello <strong>world</strong></p></body></html>",
          {
            status: 200,
            statusText: "OK",
            headers: { "content-type": "text/html; charset=utf-8" },
          },
        ),
    });
    const out = await kit.tools.fetchRequest.execute!(
      { path: "https://example.com/", format: "markdown" },
      { ...toolOpts, messages: [] },
    );
    expect(out).toContain("# Page");
    expect(out).toContain("Hello");
    expect(out).toContain("world");
    expect(out).not.toContain("```html");
  });

  test("fetchRequest markdown leaves non-HTML bodies unformatted", async () => {
    const kit = createFetchToolkit({
      fetch: async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          statusText: "OK",
          headers: { "content-type": "application/json" },
        }),
    });
    const out = await kit.tools.fetchRequest.execute!(
      { path: "https://example.com/api", format: "markdown" },
      { ...toolOpts, messages: [] },
    );
    expect(out).toContain("# HTTP 200 OK");
    expect(out).toContain("## Headers");
    expect(out).toContain("## Body");
    expect(out).toContain('"ok":true');
    expect(out).not.toContain("```json");
  });
});
