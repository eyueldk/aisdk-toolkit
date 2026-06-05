import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/adapters/index.ts",
    "src/adapters/local.ts",
    "src/adapters/docker.ts",
    "src/adapters/ssh.ts",
    "src/adapters/daytona.ts",
  ],
  format: ["esm"],
  clean: true,
  dts: true,
  sourcemap: true,
});
