import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "adapters/index": "src/adapters/index.ts",
    "adapters/firecrawl": "src/adapters/firecrawl-adapter.ts",
    "adapters/duckduckgo": "src/adapters/duckduckgo-adapter.ts",
  },
  format: ["esm"],
  clean: true,
  dts: true,
  sourcemap: true,
});
