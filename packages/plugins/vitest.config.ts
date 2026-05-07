/** vitest config for @streamd/plugins. */
import baseConfig from "@streamd/config/vitest";
import { mergeConfig } from "vitest/config";

export default mergeConfig(baseConfig, {
  test: {
    coverage: {
      thresholds: {
        statements: 90,
        branches: 70,
        functions: 95,
        lines: 90,
      },
    },
  },
});
