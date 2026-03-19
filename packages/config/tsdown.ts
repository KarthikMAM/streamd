import type { UserConfig } from "tsdown";
import { defineConfig } from "tsdown";

/** Shared base tsdown options. Import and spread to extend. */
export const baseConfig: UserConfig = {
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
};

export default defineConfig(baseConfig);
