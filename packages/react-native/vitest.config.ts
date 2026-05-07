/** vitest config for @streamd/react-native. */
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["**/*.test.{ts,tsx}", "**/*.d.ts"],
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
