/**
 * Shared vitest base configuration with coverage defaults.
 *
 * Provides a baseline test configuration that all packages extend via
 * `mergeConfig` in their own `vitest.config.ts`. Coverage thresholds are
 * intentionally conservative — packages with higher coverage raise them
 * locally.
 *
 * @module @streamd/config/vitest
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    /**
     * Enable global test APIs (`describe`, `it`, `expect`) without imports.
     *
     * Reduces boilerplate in every test file. All packages in the monorepo
     * rely on this — disabling it would break every test file.
     */
    globals: true,

    /**
     * Use Node.js as the test environment.
     *
     * The parser and renderers are environment-agnostic; Node is the
     * lightest runtime with no jsdom overhead. Packages needing DOM
     * (e.g. react) override to `"jsdom"` locally.
     */
    environment: "node",

    /**
     * Test file discovery pattern.
     *
     * Co-locates tests next to source (`src/foo.test.ts` beside `src/foo.ts`)
     * per the project convention. Excludes fixture files and benchmarks.
     */
    include: ["src/**/*.test.ts"],

    coverage: {
      /**
       * V8-native coverage provider.
       *
       * Faster than Istanbul (no instrumentation transform step) and
       * produces accurate branch coverage for modern JS/TS.
       */
      provider: "v8",

      /**
       * Source files to instrument for coverage.
       *
       * Covers all TypeScript source; test files and type-only files
       * are excluded below.
       */
      include: ["src/**/*.ts"],

      /**
       * Paths excluded from coverage instrumentation.
       *
       * - `*.test.ts` — test files are not production code.
       * - `*.d.ts` — ambient declarations have no runtime.
       * - `types/internal.ts`, `types/options.ts`, `types/tokens.ts` —
       *   type-only modules with no executable statements.
       */
      exclude: [
        "**/*.test.ts",
        "**/*.d.ts",
        "**/types/internal.ts",
        "**/types/options.ts",
        "**/types/tokens.ts",
      ],

      /**
       * Coverage report formats.
       *
       * - `text-summary` — CI-friendly console output.
       * - `json` — machine-readable for tooling.
       * - `html` — human-browsable drill-down.
       * - `lcov` — consumed by Coverlay and external dashboards.
       */
      reporter: ["text-summary", "json", "html", "lcov"],

      thresholds: {
        /**
         * Minimum statement coverage percentage.
         *
         * Set to 70% as a regression gate — renderer packages have
         * structural (tree-shape) tests that don't exhaust every branch.
         * Packages like `parser` raise this to 95%+ locally.
         */
        statements: 70,

        /**
         * Minimum branch coverage percentage.
         *
         * Lower than statements because conditional paths in renderers
         * depend on token combinations that are tested at the integration
         * level rather than unit level.
         */
        branches: 60,

        /**
         * Minimum function coverage percentage.
         *
         * Set lowest because factory/utility functions in type-heavy
         * packages may be exported for consumer use but only exercised
         * in downstream integration tests.
         */
        functions: 55,

        /**
         * Minimum line coverage percentage.
         *
         * Mirrors the statements threshold — lines and statements
         * diverge only on multi-statement lines which are rare in
         * this codebase's style.
         */
        lines: 70,
      },
    },
  },
});
