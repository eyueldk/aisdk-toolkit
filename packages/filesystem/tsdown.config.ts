import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "adapters/index": "src/adapters/index.ts",
    "adapters/memory": "src/adapters/memory-adapter.ts",
    "adapters/local": "src/adapters/local-adapter.ts",
    "adapters/docker": "src/adapters/docker-adapter.ts",
    "adapters/daytona": "src/adapters/daytona-adapter.ts",
    "adapters/composite": "src/adapters/composite-adapter.ts",
    "adapters/cloudflare-sandbox": "src/adapters/cloudflare-sandbox-adapter.ts",
  },
  format: ["esm"],
  clean: true,
  dts: true,
  sourcemap: true,
});
