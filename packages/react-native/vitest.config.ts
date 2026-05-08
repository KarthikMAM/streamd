/** vitest config for @streamd/react-native. */
import { resolve } from "node:path";
import baseConfig from "@streamd/config/vitest";
import { mergeConfig } from "vitest/config";

export default mergeConfig(baseConfig, {
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/*.d.ts",
        "**/types.ts",
        "**/types/**",
        "**/messages.ts",
        "**/src/index.ts",
        // The react-native-stub is test infrastructure, not production code.
        "**/__tests__/**",
      ],
    },
  },
  resolve: {
    alias: {
      // Lightweight stub — react-native pulls in a native runtime we don't
      // have in Node tests. The stub provides the primitives our renderer
      // actually uses (Text, View, Image, StyleSheet).
      "react-native": resolve(__dirname, "./src/__tests__/react-native-stub.ts"),
    },
  },
});
