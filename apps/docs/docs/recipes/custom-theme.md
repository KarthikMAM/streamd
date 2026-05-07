---
title: Custom theme
sidebar_position: 3
---

# Custom theme

Build a custom theme on top of `lightTheme` / `darkTheme` using
`mergeTheme`, emit CSS variables via `themeToCss` (or
`renderThemeStylesheet` from `@streamd/html`), and consume them in
the default components.

## Start from a built-in

```ts
import { lightTheme, mergeTheme } from "@streamd/tokens";

const brandTheme = mergeTheme(lightTheme, {
  name: "brand",
  colors: {
    link: "#e23",
    linkHover: "#a20",
    codeBackground: "#fbfaf7",
  },
  spacing: { md: 20 },
});
```

`mergeTheme` is shallow per top-level group (`colors`, `spacing`,
`typography`, `radii`). Fields you don't set inherit from the base
theme. The base is never mutated — `brandTheme` is a fresh object.

## Emit CSS variables

```ts
import { themeToCss } from "@streamd/tokens";

const css = themeToCss(brandTheme);
// :root {
//   --streamd-color-text: #1f2328;
//   --streamd-color-link: #e23;
//   --streamd-color-linkHover: #a20;
//   ...
// }
```

Customise selector, prefix, and unit:

```ts
themeToCss(brandTheme, {
  selector: ".app-brand",
  prefix: "md",            // → --md-color-text, --md-spacing-md-px, …
  unit: "rem",             // spacing emitted as 1.25rem instead of 20px
});
```

## Inject the stylesheet

### Plain HTML

```ts
import { themeToCss } from "@streamd/tokens";

document.head.insertAdjacentHTML(
  "beforeend",
  `<style>${themeToCss(brandTheme)}</style>`,
);
```

### Via `@streamd/html`

`renderThemeStylesheet` emits the CSS variables plus the default
selector rules (scoped to `classPrefix` if you pass one):

```ts
import { renderThemeStylesheet } from "@streamd/html";

document.head.insertAdjacentHTML(
  "beforeend",
  `<style>${renderThemeStylesheet(brandTheme, { classPrefix: "md" })}</style>`,
);
```

Pair with the renderer:

```ts
import { renderHtml } from "@streamd/html";

const html = renderHtml(tokens, { classPrefix: "md", wrapRoot: true });
```

### Via `@streamd/react`

`<ThemeProvider>` publishes the theme via React context and injects
the CSS variables on its host element, so nested default components
pick them up automatically:

```tsx
import { StreamdMarkdown, ThemeProvider } from "@streamd/react";

<ThemeProvider theme={brandTheme}>
  <StreamdMarkdown source={markdown} />
</ThemeProvider>;
```

Read the active theme from a component override:

```tsx
import { useStreamdTheme, type LinkProps } from "@streamd/react";

const MyLink = ({ href, children }: LinkProps) => {
  const theme = useStreamdTheme();
  return <a href={href} style={{ color: theme.colors.link }}>{children}</a>;
};
```

### Via `@streamd/react-native`

Same shape, different primitives:

```tsx
import { StreamdMarkdownNative, ThemeProvider } from "@streamd/react-native";

<ThemeProvider theme={brandTheme}>
  <StreamdMarkdownNative source={markdown} />
</ThemeProvider>;
```

The native `ThemeProvider` maps the same theme onto React Native
styles — no CSS variables needed.

## Dark-mode toggle

One theme per mode, one stylesheet per mode, switch via a class:

```ts
import { darkTheme, lightTheme, themeToCss } from "@streamd/tokens";

document.head.insertAdjacentHTML(
  "beforeend",
  `<style>
    ${themeToCss(lightTheme, { selector: ":root" })}
    ${themeToCss(darkTheme, { selector: ':root[data-theme="dark"]' })}
  </style>`,
);

document.documentElement.dataset.theme = userPrefersDark ? "dark" : "light";
```

In React, pass the currently-selected theme object to
`<ThemeProvider>` and let React re-render when it changes.

## Custom spacing units

```ts
themeToCss(brandTheme, { unit: "rem" });
```

The spacing numbers in `Theme` are still in pixels, but the emitted
CSS divides by 16 and outputs `rem`. Useful when you scale layout
with the user's root font size.

## Pitfalls

- **`mergeTheme` is shallow.** Overriding `colors: { link: "#e23" }`
  replaces only `link`, not the whole `colors` group. But overriding
  a nested `typography` sub-field requires an explicit object.
- **CSS variables vs React context.** The two are independent. If
  you skip `<ThemeProvider>` but inject CSS variables, default
  components still style correctly (they consume the variables). If
  you inject the provider without the CSS variables, the inline
  styles on default components still work (they read from context).
  Both together is the belt-and-braces default.
- **`unit: "rem"` only affects spacing.** Colours, radii, and
  typography sizes are emitted as-is.

## Further reading

- [@streamd/tokens](../packages/tokens) — theme shape and exports.
- [@streamd/html](../packages/html#theming) — `renderThemeStylesheet`
  options.
- [Custom components recipe](./custom-components) — how to restyle
  individual token kinds without rebuilding the whole theme.
