/** vitest config for @streamd/cli. */
import baseConfig from "@streamd/config/vitest";
import { mergeConfig } from "vitest/config";

export default mergeConfig(baseConfig, {
  test: {
    coverage: {
      exclude: [
        "**/*.test.ts",
        "**/*.d.ts",
        // Bin entry script — invokes process.exit and is verified by the
        // end-to-end smoke test rather than vitest unit tests.
        "src/bin/**",
        // Barrel re-export only — nothing to cover.
        "src/index.ts",
        // Type-only module.
        "src/types.ts",
        // String-constant error-message lookups; coverage is meaningful
        // only through the throw sites that reference them.
        "src/messages.ts",
      ],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 95,
        lines: 90,
      },
    },
  },
});
