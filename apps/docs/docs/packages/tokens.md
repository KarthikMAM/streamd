---
title: "@streamd/tokens"
sidebar_position: 2
---

# @streamd/tokens

Design tokens and light / dark themes shared by
[`@streamd/html`](./html), [`@streamd/react`](./react), and
[`@streamd/react-native`](./react-native). Ships two built-in themes,
a shallow merge helper for overrides, and a CSS-custom-property
generator so the web renderers can style from the same source of
truth as native.

Who it's for: any consumer who renders streamd markdown and wants
themed output without hand-maintaining CSS variables.

## Install

```bash
npm install @streamd/tokens
```

## Quick start

### Emit CSS variables from a theme

```ts
import { lightTheme, themeToCss } from "@streamd/tokens";

const css = themeToCss(lightTheme);
// :root {
//   --streamd-color-text: #1f2328;
//   --streamd-color-background: #ffffff;
//   ...
// }
```

Customise the selector, prefix, and unit:

```ts
themeToCss(darkTheme, { selector: ".app-dark", prefix: "md", unit: "rem" });
```

### Build a custom theme from a base

```ts
import { lightTheme, mergeTheme } from "@streamd/tokens";

const brandTheme = mergeTheme(lightTheme, {
  name: "brand",
  colors: { link: "#e23", linkHover: "#a20" },
  spacing: { md: 20 },
});
```

`mergeTheme` is shallow per top-level group (`colors`, `spacing`,
`typography`, `radii`). It never mutates the base theme.

## Key APIs

| Export | Purpose |
|---|---|
| `lightTheme`, `darkTheme` | Built-in themes. |
| `mergeTheme(base, override)` | Shallow merge returning a new `Theme`. Never mutates `base`. |
| `themeToCss(theme, options?)` | Emit `:root`-scoped CSS custom properties. `options.selector` / `options.prefix` / `options.unit` customise the output. |
| `describeArgumentType(value)` | Runtime type-description helper used by all packages' argument validators. |
| `StreamdArgumentError` | Shared `TypeError` subclass for runtime validation failures across streamd packages. |
| `Theme`, `ThemeOverride` | Public types describing the theme shape. |
| `ThemeColors`, `ThemeSpacing`, `ThemeTypography`, `ThemeRadii` | Sub-group types. |
| `ThemeToCssOptions` | Options accepted by `themeToCss`. |
| `MathRenderMode`, `TaskListCheckboxMode` | Renderer-facing enums re-exported for convenience. |

### Theme shape

```ts
interface Theme {
  name: string;
  colors: ThemeColors;       // semantic colours: text, background, link, linkHover, …
  spacing: ThemeSpacing;     // xs..xl numeric (pixels by default)
  typography: ThemeTypography;
  radii: ThemeRadii;
}
```

Full field list is in the repository at
[`packages/tokens/src/types.ts`](https://github.com/KarthikMAM/streamd/blob/main/packages/tokens/src/types.ts).

## Pairing with renderers

- **Web** — call `themeToCss()` yourself and inject the result as a
  `<style>` block, or use
  [`renderThemeStylesheet()`](./html#theming) from `@streamd/html`, or
  wrap your React tree in `<ThemeProvider>` from
  [`@streamd/react`](./react).
- **Native** — wrap your tree in `<ThemeProvider>` from
  [`@streamd/react-native`](./react-native). The provider maps the
  same theme onto React Native styles.

The [custom-theme recipe](../recipes/custom-theme) walks through
`mergeTheme` + `themeToCss` + CSS-variable consumption end-to-end.

## Source

- [README on GitHub](https://github.com/KarthikMAM/streamd/blob/main/packages/tokens/README.md)
- [Source tree](https://github.com/KarthikMAM/streamd/tree/main/packages/tokens/src)
