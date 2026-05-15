/** tsdown build config for @streamd/react. */
import { baseConfig } from "@streamd/config/tsdown";
import { defineConfig } from "tsdown";

export default defineConfig({
  ...baseConfig,
  entry: ["src/index.ts", "src/streaming/index.ts"],
});
