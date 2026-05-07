# @streamd/react

React renderer for the [`@streamd/parser`](../parser) token tree.
Ships with a `<StreamdMarkdown>` component, a `useStreamingMarkdown`
hook, and full component overrides for every token kind.

## Install

```bash
npm install @streamd/react @streamd/parser @streamd/tokens react react-dom
```

`react` and `react-dom` are peer dependencies (React 18 or 19).

## Render markdown

```tsx
import { StreamdMarkdown, ThemeProvider } from "@streamd/react";
import { darkTheme } from "@streamd/tokens";

export function Post({ markdown }: { markdown: string }) {
  return (
    <ThemeProvider theme={darkTheme}>
      <StreamdMarkdown source={markdown} parseOptions={{ gfm: true }} />
    </ThemeProvider>
  );
}
```

`<ThemeProvider>` is optional — it injects CSS variables so the
default components pick up the active theme. Skip it if you are
supplying your own styles.

## Streaming hook

```tsx
import { StreamdMarkdown, useStreamingMarkdown } from "@streamd/react";

export function LiveResponse() {
  const { tokens, append } = useStreamingMarkdown("", { gfm: true });

  useEffect(() => {
    const socket = openLLMSocket();
    socket.onMessage((chunk) => append(chunk));
    return () => socket.close();
  }, [append]);

  return <StreamdMarkdown tokens={tokens} />;
}
```

## Component overrides

Every token kind has a matching component you can replace:

```tsx
import { StreamdMarkdown, type LinkProps, type HeadingProps } from "@streamd/react";

const components = {
  heading: ({ level, id, children }: HeadingProps) =>
    React.createElement(`h${level}`, { id, className: "my-heading" }, children),
  link: ({ href, children, rel, target }: LinkProps) => (
    <a href={href} rel={rel} target={target} className="my-link">
      {children}
    </a>
  ),
};

<StreamdMarkdown source={md} components={components} />;
```

See [`src/types.ts`](src/types.ts) for the full `Components` shape.
`createDefaultComponents()` is also exported if you want to spread the
defaults into a partial override.

## Plugins + `allowDangerousMetaHtml`

```tsx
import { StreamdMarkdown } from "@streamd/react";
import { headingAnchors, linkAttributes, sanitize } from "@streamd/plugins";

<StreamdMarkdown
  source={userMarkdown}
  parseOptions={{ gfm: true }}
  plugins={[headingAnchors(), linkAttributes(), sanitize()]}
/>;
```

Plugins that attach pre-rendered HTML to `token.meta.html` (for
example [`@streamd/plugin-shiki`](../plugin-shiki) or
[`@streamd/plugin-katex`](../plugin-katex)) require an explicit opt-in
before the default components will consume the HTML:

```tsx
<StreamdMarkdown
  source={markdown}
  plugins={[shikiPlugin, sanitize({ allowRawHtml: true })]}
  allowDangerousMetaHtml
/>
```

`allowDangerousMetaHtml` is forwarded to `CodeBlockProps` so custom
`codeBlock` overrides can honour it via `dangerouslySetInnerHTML`.
Leave the flag off (default: `false`) whenever you cannot vouch for
every plugin in the pipeline — see the [security model in the root
README](../../README.md#security-model).

## Direct render function

When you want to bypass the component wrapper — for example, to render
into a pre-existing React tree during server-side rendering — the
package exports `renderReact(tokens, options?)` which returns a
`ReactNode`:

```tsx
import { parse } from "@streamd/parser";
import { renderReact } from "@streamd/react";

const { tokens } = parse("# hello");
const node = renderReact(tokens);
```

## Accessibility

The default components emit ARIA attributes on tokens that benefit
from them:

- Task-list checkboxes render with `aria-checked` and
  `aria-disabled` set explicitly (not just via the `checked`
  attribute) so screen readers announce the state consistently.
- Fenced code blocks with a declared language render the `<pre>` with
  `role="region"` + `aria-label="<lang> code block"` so the block is
  announced as a landmark.

## Validation

`renderReact` and `<StreamdMarkdown>` throw
`StreamdReactArgumentError` (a `TypeError` subclass extending the
shared `StreamdArgumentError` from `@streamd/tokens`) for wrong-typed
inputs — unknown token types, a non-array `tokens` prop, or a
non-string `source`.

## Pairing

- Parser: [`@streamd/parser`](../parser)
- Plugins: [`@streamd/plugins`](../plugins)
- Monorepo overview: [`streamd README`](../../README.md)

## Known differences vs `@streamd/html`

`@streamd/react` produces the same logical DOM as `@streamd/html`, but the
rendered markup differs for raw-HTML tokens because React requires a host
element for `dangerouslySetInnerHTML`:

- `HtmlInline` tokens render inside a `<span class="streamd-html-inline">`
  host element in the React renderer. The HTML renderer emits the raw
  inline HTML content directly with no wrapper.
- `HtmlBlock` tokens render inside a `<div class="streamd-html-block">`
  host element in the React renderer. The HTML renderer emits the raw
  block HTML content directly with no wrapper.

This is a deliberate design choice: it matches the approach taken by
`react-markdown`, `@mdx-js/react`, and other React markdown libraries.
The alternative — using a React Fragment and custom server-side
serialization — would complicate the SSR code path significantly for
no visible benefit in practice. The streaming-equivalence fuzzer's
parity checker unwraps these wrappers before comparing against the HTML
renderer's output (see
`packages/e2e/src/fuzzer/invariants.ts#normalizeHtml`).

## License

MIT.
