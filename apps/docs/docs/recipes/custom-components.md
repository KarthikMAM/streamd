---
title: Custom components
sidebar_position: 4
---

# Custom components

Override individual token components without reimplementing the
whole renderer. The `components` prop on `<StreamdMarkdown>` and
`<StreamdMarkdownNative>` accepts a partial `Components` record —
only the kinds you override; everything else keeps its default.

## React

```tsx
import {
  StreamdMarkdown,
  type HeadingProps,
  type LinkProps,
} from "@streamd/react";

const components = {
  heading: ({ level, id, children }: HeadingProps) =>
    React.createElement(
      `h${level}`,
      { id, className: "my-heading" },
      children,
    ),
  link: ({ href, children, rel, target }: LinkProps) => (
    <a href={href} rel={rel} target={target} className="my-link">
      {children}
    </a>
  ),
};

<StreamdMarkdown source={markdown} components={components} />;
```

Kinds you can override: `blockquote`, `codeBlock`, `codeSpan`,
`heading`, `html`, `image`, `link`, `list`, `listItem`, `math`,
`paragraph`, `strikethrough`, `strong`, `em`, `table`, `text`,
`thematicBreak`. Each has a matching `*Props` type re-exported from
`@streamd/react`.

See the full set at
[`packages/react/src/types.ts`](https://github.com/KarthikMAM/streamd/blob/main/packages/react/src/types.ts).

### Read the active theme

From inside an override, use `useStreamdTheme()`:

```tsx
import { useStreamdTheme, type CodeBlockProps } from "@streamd/react";

const CodeBlock = ({ content, lang }: CodeBlockProps) => {
  const theme = useStreamdTheme();
  return (
    <pre style={{ background: theme.colors.codeBackground }}>
      <code>{content}</code>
    </pre>
  );
};
```

### Compose on top of the defaults

```tsx
import { createDefaultComponents, StreamdMarkdown } from "@streamd/react";
import { lightTheme } from "@streamd/tokens";

const defaults = createDefaultComponents(lightTheme);

const components = {
  ...defaults,
  link: (props) => <a {...props} className="tracked-link" />,
};

<StreamdMarkdown source={markdown} components={components} />;
```

Useful when your override wants to wrap the default output — the
default component is a regular React component you can render from
your own.

## React Native

Same shape, React Native primitives:

```tsx
import {
  StreamdMarkdownNative,
  type CodeBlockProps,
  type HeadingProps,
} from "@streamd/react-native";
import { StyleSheet, Text, View } from "react-native";

const styles = StyleSheet.create({
  code: { backgroundColor: "#fbfaf7", padding: 12, borderRadius: 6 },
  heading: { fontFamily: "Inter-Bold", marginVertical: 8 },
});

const components = {
  heading: ({ level, children }: HeadingProps) => (
    <Text style={[styles.heading, { fontSize: 32 - level * 3 }]}>{children}</Text>
  ),
  codeBlock: ({ content, lang }: CodeBlockProps) => (
    <View style={styles.code}>
      <Text selectable>{content}</Text>
    </View>
  ),
};

<StreamdMarkdownNative source={markdown} components={components} />;
```

### Read the active theme

```tsx
import { useStreamdTheme } from "@streamd/react-native";

const CodeBlock = ({ content }) => {
  const theme = useStreamdTheme();
  return (
    <View style={{ backgroundColor: theme.colors.codeBackground }}>
      <Text>{content}</Text>
    </View>
  );
};
```

## Common overrides

### Track outbound links

```tsx
const Link = ({ href, children, target }: LinkProps) => (
  <a
    href={href}
    target={target}
    onClick={() => analytics.track("link_click", { href })}
  >
    {children}
  </a>
);
```

Keep `target` in the signature so `linkAttributes()` output (e.g.
`target="_blank"`) still works.

### Numbered task-list items

```tsx
const ListItem = ({ checked, children }: ListItemProps) => (
  <li data-state={checked == null ? "text" : checked ? "done" : "todo"}>
    {checked != null && <input type="checkbox" checked={checked} readOnly />}
    {children}
  </li>
);
```

`checked` is `null` for non-task items, `true` / `false` for tasks.

### Custom image component

```tsx
const Image = ({ src, alt, title }: ImageProps) => (
  <figure>
    <img src={src} alt={alt} loading="lazy" />
    {title && <figcaption>{title}</figcaption>}
  </figure>
);
```

## Pitfalls

- **Overrides run after plugins.** `sanitize()` has already rewritten
  link schemes and stripped dangerous `meta.attrs` by the time your
  component runs. Don't re-implement that logic in the component.
- **`meta.html` is still gated.** If your override wants to
  `dangerouslySetInnerHTML` from `meta.html`, it runs regardless of
  the renderer's `allowDangerousMetaHtml` flag — you've opted out of
  that defence yourself. Only do it for trusted plugin output.
- **Inline overrides re-create on every render.** Declare component
  overrides module-scoped or memoised with `useMemo` to keep React
  reconciliation efficient.

## Further reading

- [@streamd/react](../packages/react) — full component override API
  and types.
- [@streamd/react-native](../packages/react-native) — native
  equivalents.
- [Custom theme recipe](./custom-theme) — restyle without replacing
  components.
