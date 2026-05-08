/** tsdown build config for @streamd/react-native. */
import { baseConfig } from "@streamd/config/tsdown";
import { defineConfig } from "tsdown";

export default defineConfig({
  ...baseConfig,
  entry: {
    index: "src/index.ts",
    streaming: "src/streaming/index.ts",
  },
  external: ["react", "react-native"],
});
