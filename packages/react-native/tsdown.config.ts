/** tsdown build config for @streamd/react-native. */
import { baseConfig } from "@streamd/config/tsdown";
import { defineConfig } from "tsdown";

export default defineConfig({
  ...baseConfig,
  external: ["react", "react-native"],
});
