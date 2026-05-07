# @streamd/config

Internal — not published. Shared `tsdown` + `vitest` + `tsconfig`
presets for the streamd monorepo.

## Exports

- `@streamd/config/tsdown` — default tsdown build config (`esm` + `cjs`,
  sourcemaps, declarations).
- `@streamd/config/vitest` — default vitest config with v8 coverage
  provider wired up.
- `@streamd/config/tsconfig/base` — strict TypeScript base (ES2022
  target, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`,
  `isolatedModules`).
- `@streamd/config/tsconfig/library` — extends base, adds `composite`
  + `declarationDir`.

## Usage

```json
{
  "extends": "@streamd/config/tsconfig/library",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

```ts
// vitest.config.ts
import baseConfig from "@streamd/config/vitest";
import { mergeConfig } from "vitest/config";

export default mergeConfig(baseConfig, {});
```
