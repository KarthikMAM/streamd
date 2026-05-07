/**
 * Default React components — one per token type.
 *
 * All components accept className-compatible props but render
 * standard HTML semantic elements. Consumers override via the
 * `components` prop of `<StreamdMarkdown>`.
 *
 * Every default component is wrapped in `React.memo` so streaming
 * re-renders skip unchanged subtrees. Inline-style default components
 * close over `prefix` only, so their props drive every difference.
 *
 * @module components
 */
import { createElement, memo, type ReactNode } from "react";
import type {
  BaseProps,
  CodeBlockProps,
  CodeSpanProps,
  Components,
  HeadingProps,
  HtmlProps,
  ImageProps,
  LinkProps,
  ListItemProps,
  ListProps,
  MathProps,
  TableProps,
} from "./types";

/** Default CSS class prefix — matches the npm package scope (`streamd-*`). */
const DEFAULT_PREFIX = "streamd";

/**
 * Resolves the effective `rel` value for a `<Link>` given the caller's
 * `target` and `rel` props.
 *
 * When `target !== "_blank"` the author-supplied rel is returned as-is
 * (may be `undefined`). When `target === "_blank"` the function ensures
 * both `noopener` and `noreferrer` are present: already-present tokens
 * are never duplicated, and author-supplied extra tokens (for example
 * `external`, `nofollow`) are preserved in insertion order.
 *
 * The augmentation is purely additive, so overriding `Link` components
 * that compute `rel` themselves can still call into this helper to
 * inherit the `target="_blank"` safety guarantee.
 *
 * @param target - The `<a target>` value or `undefined`.
 * @param rel - The author-supplied rel string or `undefined`.
 * @returns The resolved rel string, or `undefined` when no rel should
 *   be emitted (not `_blank` and no author-supplied rel).
 */
function resolveLinkRel(target: string | undefined, rel: string | undefined): string | undefined {
  if (target !== "_blank") return rel;
  const existing = new Set<string>();
  if (rel) {
    for (const token of rel.split(" ")) {
      if (token.length > 0) existing.add(token);
    }
  }
  const hasNoopener = existing.has("noopener");
  const hasNoreferrer = existing.has("noreferrer");
  if (hasNoopener && hasNoreferrer) return rel;
  if (!hasNoopener) existing.add("noopener");
  if (!hasNoreferrer) existing.add("noreferrer");
  return Array.from(existing).join(" ");
}

/**
 * Build the default component set. The prefix is injected so all default
 * components share consistent class names.
 *
 * The returned map defines a component for every key in {@link Components},
 * so the return type is narrowed to `Required<Components>`: consumers can
 * access any field without a null check.
 *
 * @param prefix - CSS class prefix (e.g. "streamd").
 * @returns Frozen `Required<Components>` object.
 */
export function createDefaultComponents(prefix: string = DEFAULT_PREFIX): Required<Components> {
  /** Build a prefixed class name for a given token kind. */
  const cls = (kind: string): string => `${prefix}-${kind}`;

  /** Blockquote component — renders a `<blockquote>`. */
  const Blockquote = memo(
    (props: BaseProps): ReactNode =>
      createElement("blockquote", { className: cls("blockquote") }, props.children),
  );
  Blockquote.displayName = "StreamdBlockquote";

  /** List component — renders `<ul>` or `<ol>` depending on `props.ordered`. */
  const List = memo(
    (props: ListProps): ReactNode =>
      createElement(
        props.ordered ? "ol" : "ul",
        {
          className: cls(props.ordered ? "ol" : "ul"),
          start: props.ordered && props.start !== 1 ? props.start : undefined,
        },
        props.children,
      ),
  );
  List.displayName = "StreamdList";

  /** List-item component — renders a `<li>` with an optional GFM task-list checkbox.
   *
   *  The checkbox is always `disabled` — users cannot toggle a markdown
   *  task-list item through the rendered DOM, so `disabled` is the only
   *  attribute that matters behaviourally. The HTML renderer in
   *  `@streamd/html` emits the same set of attributes (`checked`,
   *  `disabled`, `type`, `role`, `aria-checked`, `aria-disabled`); this
   *  component is kept in byte-for-byte lock-step so the fuzzer's
   *  React/HTML parity invariant holds without attribute-strip shims.
   *
   *  `readOnly` is intentionally not set. React's "controlled input
   *  without `onChange`" warning does not fire for `disabled` inputs in
   *  React 18/19 — the warning targets interactive controls only — so the
   *  extra attribute would add noise to the output without silencing any
   *  real warning.
   */
  const ListItem = memo((props: ListItemProps): ReactNode => {
    const parts: Array<ReactNode> = [];
    if (props.checked !== null) {
      parts.push(
        createElement("input", {
          key: "cb",
          type: "checkbox",
          checked: props.checked,
          disabled: true,
          role: "checkbox",
          "aria-checked": props.checked,
          "aria-disabled": true,
          className: cls("task-checkbox"),
        }),
        " ",
      );
    }
    parts.push(props.children);
    return createElement("li", { className: cls("li") }, ...parts);
  });
  ListItem.displayName = "StreamdListItem";

  /** Heading component — renders `<h1>`…`<h6>` with an optional `id` anchor. */
  const Heading = memo(
    (props: HeadingProps): ReactNode =>
      createElement(
        `h${props.level}`,
        {
          className: cls(`h${props.level}`),
          id: props.id,
        },
        props.children,
      ),
  );
  Heading.displayName = "StreamdHeading";

  /** Paragraph component — renders a `<p>`. */
  const Paragraph = memo(
    (props: BaseProps): ReactNode => createElement("p", { className: cls("p") }, props.children),
  );
  Paragraph.displayName = "StreamdParagraph";

  /** Code-block component — renders `<pre><code>` or injects pre-highlighted HTML.
   *
   *  The `props.html` path is gated behind `props.allowDangerousMetaHtml`:
   *  when the flag is not `true`, the default component ignores `props.html`
   *  and falls back to the plain `<pre><code>` shell with text content. This
   *  keeps the default renderer safe against plugin-injected XSS payloads.
   *
   *  Accessibility (H11): the `<pre>` receives `tabindex={0}` so keyboard
   *  users can focus the container and scroll horizontally through wide
   *  code samples. When a language is set, it also carries `role="region"`
   *  and a descriptive `aria-label="{lang} code block"` so screen readers
   *  announce the landmark; without a language neither aria attribute is
   *  emitted to avoid the "undefined code block" announcement footgun.
   */
  const CodeBlock = memo((props: CodeBlockProps): ReactNode => {
    const hasHtml = props.html !== undefined;
    const htmlAllowed = props.allowDangerousMetaHtml === true;
    if (hasHtml && htmlAllowed) {
      return createElement("div", {
        className: cls("pre"),
        dangerouslySetInnerHTML: { __html: props.html },
      });
    }
    const hasLang = props.lang.length > 0;
    const codeClass = hasLang ? `language-${props.lang}` : undefined;
    const preProps: Record<string, unknown> = {
      className: cls("pre"),
      tabIndex: 0,
    };
    if (hasLang) {
      preProps["role"] = "region";
      preProps["aria-label"] = `${props.lang} code block`;
    }
    return createElement(
      "pre",
      preProps,
      createElement("code", { className: codeClass }, props.content),
    );
  });
  CodeBlock.displayName = "StreamdCodeBlock";

  /** HTML-block component — renders raw HTML inside a `<div>`. */
  const HtmlBlock = memo(
    (props: HtmlProps): ReactNode =>
      createElement("div", {
        className: cls("html-block"),
        dangerouslySetInnerHTML: { __html: props.content },
      }),
  );
  HtmlBlock.displayName = "StreamdHtmlBlock";

  /** Thematic-break component — renders `<hr>`. */
  const Hr = memo((): ReactNode => createElement("hr", { className: cls("hr") }));
  Hr.displayName = "StreamdHr";

  /** Table component — renders a full GFM table with `<thead>`/`<tbody>`. */
  const Table = memo((props: TableProps): ReactNode => {
    const headCells = props.head.map((cell, i) =>
      createElement("th", { key: i, scope: "col", align: props.align[i] ?? undefined }, cell),
    );
    const bodyRows = props.rows.map((row, r) =>
      createElement(
        "tr",
        { key: r },
        row.map((cell, c) =>
          createElement("td", { key: c, align: props.align[c] ?? undefined }, cell),
        ),
      ),
    );
    return createElement(
      "table",
      { className: cls("table") },
      createElement("thead", null, createElement("tr", null, headCells)),
      bodyRows.length > 0 ? createElement("tbody", null, bodyRows) : null,
    );
  });
  Table.displayName = "StreamdTable";

  /** Display-math component — renders TeX inside `<pre><code class="language-math">`. */
  const MathBlock = memo(
    (props: MathProps): ReactNode =>
      createElement(
        "pre",
        {
          className: cls("math-block"),
          role: "math",
          "aria-label": "math block",
        },
        createElement("code", { className: "language-math math-display" }, props.content),
      ),
  );
  MathBlock.displayName = "StreamdMathBlock";

  /** Text component — emits literal text content. */
  const Text = memo((props: { readonly content: string }): ReactNode => props.content);
  Text.displayName = "StreamdText";

  /** Soft-break component — emits a newline character. */
  const Softbreak = memo((): ReactNode => "\n");
  Softbreak.displayName = "StreamdSoftbreak";

  /** Hard-break component — renders `<br>`. */
  const Hardbreak = memo((): ReactNode => createElement("br", { className: cls("br") }));
  Hardbreak.displayName = "StreamdHardbreak";

  /** Code-span component — renders `<code>` with the literal content. */
  const CodeSpan = memo(
    (props: CodeSpanProps): ReactNode =>
      createElement("code", { className: cls("code") }, props.content),
  );
  CodeSpan.displayName = "StreamdCodeSpan";

  /** Emphasis component — renders `<em>`. */
  const Em = memo(
    (props: BaseProps): ReactNode => createElement("em", { className: cls("em") }, props.children),
  );
  Em.displayName = "StreamdEm";

  /** Strong-emphasis component — renders `<strong>`. */
  const Strong = memo(
    (props: BaseProps): ReactNode =>
      createElement("strong", { className: cls("strong") }, props.children),
  );
  Strong.displayName = "StreamdStrong";

  /** Strikethrough component — renders `<del>`. */
  const Strikethrough = memo(
    (props: BaseProps): ReactNode =>
      createElement("del", { className: cls("del") }, props.children),
  );
  Strikethrough.displayName = "StreamdStrikethrough";

  /** Link component — renders `<a>` with href/title/rel/target.
   *
   *  Accessibility / security (H11): when `props.target === "_blank"` the
   *  component defensively augments `rel` with `noopener noreferrer` so
   *  the new tab cannot reach back into `window.opener` (tab-nabbing)
   *  and cannot leak the referring URL via `document.referrer`. When
   *  `props.rel` already lists both tokens the value is passed through
   *  unchanged; missing tokens are appended without duplicating any
   *  author-supplied ones. When the link does not open a new tab, the
   *  author-supplied rel (if any) is forwarded as-is.
   */
  const Link = memo((props: LinkProps): ReactNode => {
    const combinedClass = props.className ? `${cls("a")} ${props.className}` : cls("a");
    const rel = resolveLinkRel(props.target, props.rel);
    return createElement(
      "a",
      {
        className: combinedClass,
        href: props.href,
        title: props.title.length > 0 ? props.title : undefined,
        rel,
        target: props.target,
      },
      props.children,
    );
  });
  Link.displayName = "StreamdLink";

  /** Image component — renders `<img>` with src/alt/title. */
  const Image = memo(
    (props: ImageProps): ReactNode =>
      createElement("img", {
        className: cls("img"),
        src: props.src,
        alt: props.alt,
        title: props.title.length > 0 ? props.title : undefined,
      }),
  );
  Image.displayName = "StreamdImage";

  /** Inline-HTML component — renders raw HTML inside a `<span>`. */
  const HtmlInline = memo(
    (props: HtmlProps): ReactNode =>
      createElement("span", {
        className: cls("html-inline"),
        dangerouslySetInnerHTML: { __html: props.content },
      }),
  );
  HtmlInline.displayName = "StreamdHtmlInline";

  /** Escape component — emits the escaped character as literal text. */
  const Escape = memo((props: { readonly content: string }): ReactNode => props.content);
  Escape.displayName = "StreamdEscape";

  /** Inline-math component — renders TeX inside `<code class="math-inline">`. */
  const MathInline = memo(
    (props: MathProps): ReactNode =>
      createElement(
        "code",
        { className: `${cls("math-inline")} language-math math-inline` },
        props.content,
      ),
  );
  MathInline.displayName = "StreamdMathInline";

  return Object.freeze({
    blockquote: Blockquote,
    list: List,
    listItem: ListItem,
    heading: Heading,
    paragraph: Paragraph,
    codeBlock: CodeBlock,
    htmlBlock: HtmlBlock,
    hr: Hr,
    table: Table,
    mathBlock: MathBlock,
    text: Text,
    softbreak: Softbreak,
    hardbreak: Hardbreak,
    codeSpan: CodeSpan,
    em: Em,
    strong: Strong,
    strikethrough: Strikethrough,
    link: Link,
    image: Image,
    htmlInline: HtmlInline,
    escape: Escape,
    mathInline: MathInline,
  });
}
