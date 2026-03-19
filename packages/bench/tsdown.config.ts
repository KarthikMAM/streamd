import { baseConfig } from "@streamd/config/tsdown";
import { defineConfig } from "tsdown";

export default defineConfig({
  ...baseConfig,
  entry: ["src/browser-parsers.ts"],
  format: ["esm"],
  outDir: "dist",
  dts: false,
  sourcemap: false,
  minify: true,
  platform: "browser",
  deps: { alwaysBundle: [/.*/] },
});
