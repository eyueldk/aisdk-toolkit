import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "adapters/index": "src/adapters/index.ts",
    "adapters/local": "src/adapters/local-adapter.ts",
    "adapters/docker": "src/adapters/docker-adapter.ts",
    "adapters/ssh": "src/adapters/ssh-adapter.ts",
    "adapters/daytona": "src/adapters/daytona-adapter.ts",
    "adapters/cloudflare-sandbox": "src/adapters/cloudflare-sandbox-adapter.ts",
  },
  format: ["esm"],
  clean: true,
  dts: true,
  sourcemap: true,
});
