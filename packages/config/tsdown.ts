/**
 * Shared tsdown base configuration for library bundling.
 *
 * Exports a `baseConfig` object that packages spread into their own
 * `tsdown.config.ts` to inherit standard entry, format, and output
 * settings. The default export wraps `baseConfig` in `defineConfig`
 * for packages that need no overrides.
 *
 * @example
 * ```ts
 * import { baseConfig } from "@streamd/config/tsdown";
 * import { defineConfig } from "tsdown";
 *
 * export default defineConfig({ ...baseConfig, entry: ["src/index.ts", "src/plugins.ts"] });
 * ```
 *
 * @module @streamd/config/tsdown
 */
import type { UserConfig } from "tsdown";
import { defineConfig } from "tsdown";

/**
 * Shared base tsdown options for all library packages.
 *
 * Produces ESM + CJS dual output with TypeScript declarations,
 * source maps, and a clean output directory on each build.
 * Packages spread this into their own config and override only
 * the fields that differ (e.g. multiple entry points).
 */
export const baseConfig: UserConfig = {
  /**
   * Bundle entry point(s).
   *
   * Defaults to the single barrel `src/index.ts`. Packages with
   * multiple public entry points (e.g. `plugins`) override this
   * array in their local config.
   */
  entry: ["src/index.ts"],

  /**
   * Output module formats.
   *
   * Dual ESM + CJS ensures compatibility with both modern bundlers
   * (tree-shaking via ESM) and legacy Node.js `require()` consumers.
   */
  format: ["esm", "cjs"],

  /**
   * Emit TypeScript declaration files (`.d.ts`).
   *
   * Required for downstream type-checking without depending on the
   * source package at build time. Enables IDE autocompletion for
   * consumers.
   */
  dts: true,

  /**
   * Remove the output directory before each build.
   *
   * Prevents stale artifacts from previous builds from leaking into
   * the published package. Safe because builds are deterministic.
   */
  clean: true,

  /**
   * Generate source maps alongside output files.
   *
   * Enables stack-trace mapping back to TypeScript source in error
   * reports and debugger sessions. Negligible size cost for library
   * packages.
   */
  sourcemap: true,
};

export default defineConfig(baseConfig);
