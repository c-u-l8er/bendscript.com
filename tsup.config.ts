import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "index": "src/index.ts",
    "harness/index": "src/harness/index.ts",
  },
  format: ["esm"],
  dts: true,
  target: "node20",
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
});
