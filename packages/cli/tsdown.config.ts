/**
 * tsdown build config for @streamd/cli.
 *
 * Two entry points:
 *  - `src/index.ts` — programmatic `run(argv, streams)` API
 *  - `src/bin/streamd.ts` — installed as the `streamd` bin via `package.json#bin`
 *
 * ESM-only because the public export map advertises `import` only; the
 * CLI is invoked by Node (via shebang or `node ...`) which has first-class
 * ESM support on the declared `engines.node: >=22`.
 */
import { baseConfig } from "@streamd/config/tsdown";
import { defineConfig } from "tsdown";

export default defineConfig({
  ...baseConfig,
  entry: ["src/index.ts", "src/bin/streamd.ts"],
  format: ["esm"],
});
