/** vitest config for cross-package end-to-end integration tests. */
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "react-native": resolve(__dirname, "../react-native/src/__tests__/react-native-stub.ts"),
    },
  },
});
