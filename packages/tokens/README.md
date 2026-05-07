# @streamd/tokens

Design tokens and light / dark themes shared by
[`@streamd/html`](../html), [`@streamd/react`](../react), and
[`@streamd/react-native`](../react-native).

## Install

```bash
npm install @streamd/tokens
```

## Use a built-in theme

```ts
import { darkTheme, lightTheme, themeToCss } from "@streamd/tokens";

// Emit CSS custom properties
const css = themeToCss(lightTheme);
// => ":root {\n  --streamd-color-text: #1f2328;\n  ...\n}"

// Custom selector / prefix / unit
themeToCss(darkTheme, { selector: ".app-dark", prefix: "md", unit: "rem" });
```

## Customise a theme

```ts
import { lightTheme, mergeTheme } from "@streamd/tokens";

const brandTheme = mergeTheme(lightTheme, {
  name: "brand",
  colors: {
    link: "#e23",
    linkHover: "#a20",
  },
  spacing: { md: 20 },
});
```

`mergeTheme` is shallow per top-level group (colors / spacing /
typography / radii) and never mutates the base theme.

## Shape

```ts
interface Theme {
  name: string;
  colors: ThemeColors;       // 11 semantic colours
  spacing: ThemeSpacing;     // xs..xl numeric
  typography: ThemeTypography;
  radii: ThemeRadii;
}
```

See [`src/types.ts`](src/types.ts) for the full shape — `ThemeOverride`
is the deep-partial form accepted by `mergeTheme`, and
`ThemeToCssOptions` controls the generated CSS (selector, prefix,
unit).

## Shared error root

`StreamdArgumentError` is the shared `TypeError` subclass that every
downstream `Streamd*ArgumentError` (`@streamd/html`, `@streamd/react`,
`@streamd/react-native`, `@streamd/plugins`, `@streamd/plugin-shiki`,
`@streamd/plugin-katex`, `@streamd/cli`) extends. A single
`catch (err instanceof StreamdArgumentError)` handler covers every
streamd input-validation error.

`describeArgumentType(value)` is a small helper that produces the
human-readable type description used in those error messages
(`"string"`, `"array"`, `"null"`, `"object"`, etc.).

## Pairing

- Web rendering: pass the theme to
  [`renderThemeStylesheet`](../html/src/streaming.ts) in `@streamd/html`
  or to `<ThemeProvider>` in `@streamd/react`.
- Native rendering: pass the theme to `<ThemeProvider>` in
  `@streamd/react-native`.
- Monorepo overview: [`streamd README`](../../README.md).

## License

MIT.
