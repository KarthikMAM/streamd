/** vitest config for @streamd/react. */
import baseConfig from "@streamd/config/vitest";
import { mergeConfig } from "vitest/config";

export default mergeConfig(baseConfig, {
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      include: ["src/**/*.{ts,tsx}"],
      // Extend base exclusions with the .tsx variants for React components.
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/*.d.ts",
        "**/types.ts",
        "**/types/**",
        "**/messages.ts",
        "**/src/index.ts",
      ],
    },
  },
});
