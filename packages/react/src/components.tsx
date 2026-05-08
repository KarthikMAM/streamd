/**
 * Default React components — one per token type (20 total).
 *
 * All components render standard HTML semantic elements with prefixed
 * class names. Consumers override via the `components` prop on
 * `<StreamdMarkdown>` using the token-type-keyed `ReactComponents` map.
 *
 * Every default component is wrapped in `React.memo` so streaming
 * re-renders skip unchanged subtrees.
 *
 * @module components
 */
import type { HighlightData, ThemedSegment } from "@streamd/parser";
import { createElement, memo, type ReactNode } from "react";
import type {
  BaseProps,
  CodeBlockProps,
  CodeSpanProps,
  HeadingProps,
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
 * Internal component map type — one component per token kind.
 * Used as the return type of `createDefaultComponents`.
 */
export interface DefaultComponents {
  readonly blockquote: React.ComponentType<BaseProps>;
  readonly list: React.ComponentType<ListProps>;
  readonly listItem: React.ComponentType<ListItemProps>;
  readonly heading: React.ComponentType<HeadingProps>;
  readonly paragraph: React.ComponentType<BaseProps>;
  readonly codeBlock: React.ComponentType<CodeBlockProps>;
  readonly hr: React.ComponentType<Record<never, never>>;
  readonly table: React.ComponentType<TableProps>;
  readonly mathBlock: React.ComponentType<MathProps>;
  readonly text: React.ComponentType<{ readonly content: string }>;
  readonly hardbreak: React.ComponentType<Record<never, never>>;
  readonly codeSpan: React.ComponentType<CodeSpanProps>;
  readonly em: React.ComponentType<BaseProps>;
  readonly strong: React.ComponentType<BaseProps>;
  readonly strikethrough: React.ComponentType<BaseProps>;
  readonly link: React.ComponentType<LinkProps>;
  readonly image: React.ComponentType<ImageProps>;
  readonly escape: React.ComponentType<{ readonly content: string }>;
  readonly mathInline: React.ComponentType<MathProps>;
}

/**
 * Resolves the effective `rel` value for a `<Link>` given the caller's
 * `target` and `rel` props.
 *
 * When `target === "_blank"` the function ensures both `noopener` and
 * `noreferrer` are present. Otherwise the author-supplied rel is
 * returned as-is.
 *
 * @param target - The `<a target>` value or `undefined`.
 * @param rel - The author-supplied rel string or `undefined`.
 * @returns The resolved rel string, or `undefined` when no rel should be emitted.
 */
function resolveLinkRel(target: string | undefined, rel: string | undefined): string | undefined {
  if (target !== "_blank") return rel;
  const existing = new Set<string>();
  if (rel) {
    for (const token of rel.split(" ")) {
      if (token.length > 0) existing.add(token);
    }
  }
  if (!existing.has("noopener")) existing.add("noopener");
  if (!existing.has("noreferrer")) existing.add("noreferrer");
  return Array.from(existing).join(" ");
}

/**
 * Renders a single themed segment as a `<span>` with inline style.
 *
 * @param seg - Themed segment from plugin-shiki highlight data.
 * @param key - React key for the element.
 * @returns ReactNode for the styled span.
 */
function renderSegment(seg: ThemedSegment, key: string): ReactNode {
  const style: Record<string, string> = {};
  if (seg.color) style["color"] = seg.color;
  if (seg.bold) style["fontWeight"] = "bold";
  if (seg.italic) style["fontStyle"] = "italic";
  if (seg.underline) style["textDecoration"] = "underline";
  const hasStyle = Object.keys(style).length > 0;
  return createElement("span", { key, style: hasStyle ? style : undefined }, seg.text);
}

/**
 * Renders structured highlight data as a `<pre><code>` with styled spans.
 *
 * Each line is a `<div>` containing one `<span>` per themed segment.
 *
 * @param highlight - Structured highlight data from plugin-shiki.
 * @param cls - CSS class builder function.
 * @param lang - Language identifier for the code block.
 * @returns ReactNode for the highlighted code block.
 */
function renderHighlighted(
  highlight: HighlightData,
  cls: (kind: string) => string,
  lang: string,
): ReactNode {
  const lines = highlight.lines.map((line, li) =>
    createElement(
      "div",
      { key: li, className: cls("code-line") },
      ...line.map((seg, si) => renderSegment(seg, `${li}-${si}`)),
    ),
  );
  const hasLang = lang.length > 0;
  const preProps: Record<string, unknown> = {
    className: cls("pre"),
    tabIndex: 0,
  };
  if (hasLang) {
    preProps["role"] = "region";
    preProps["aria-label"] = `${lang} code block`;
  }
  return createElement("pre", preProps, createElement("code", null, ...lines));
}

/**
 * Build the default component set for all 20 token types.
 *
 * The prefix is injected so all default components share consistent
 * class names. The returned map defines a component for every token kind.
 *
 * @param prefix - CSS class prefix (e.g. "streamd").
 * @returns Frozen `DefaultComponents` object.
 */
export function createDefaultComponents(prefix: string = DEFAULT_PREFIX): DefaultComponents {
  const cls = (kind: string): string => `${prefix}-${kind}`;

  /** Blockquote component — renders a `<blockquote>`. */
  const Blockquote = memo(
    (props: BaseProps): ReactNode =>
      createElement("blockquote", { className: cls("blockquote") }, props.children),
  );
  Blockquote.displayName = "StreamdBlockquote";

  /** List component — renders `<ul>` or `<ol>`. */
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

  /** List-item component — renders a `<li>` with optional GFM task-list checkbox. */
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

  /** Heading component — renders `<h1>`…`<h6>` with optional `id` anchor. */
  const Heading = memo(
    (props: HeadingProps): ReactNode =>
      createElement(
        `h${props.level}`,
        { className: cls(`h${props.level}`), id: props.id },
        props.children,
      ),
  );
  Heading.displayName = "StreamdHeading";

  /** Paragraph component — renders a `<p>`. */
  const Paragraph = memo(
    (props: BaseProps): ReactNode => createElement("p", { className: cls("p") }, props.children),
  );
  Paragraph.displayName = "StreamdParagraph";

  /**
   * Code-block component — renders `<pre><code>` with structured highlight
   * spans when `meta.highlight` is present, otherwise plain text content.
   *
   * To render syntax-highlighted code, use plugin-shiki which attaches
   * `HighlightData` to `CodeBlock.meta.highlight`. To use KaTeX for math,
   * override `components.math_block` with a custom component.
   */
  const CodeBlock = memo((props: CodeBlockProps): ReactNode => {
    if (props.highlight) {
      return renderHighlighted(props.highlight, cls, props.lang);
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

  /**
   * Display-math component — renders raw TeX in `<pre><code>`.
   *
   * To render formatted math, override `components.math_block` with a
   * component that calls KaTeX or MathJax against `token.content`.
   */
  const MathBlock = memo(
    (props: MathProps): ReactNode =>
      createElement(
        "pre",
        { className: cls("math-block"), role: "math", "aria-label": "math block" },
        createElement("code", { className: "language-math math-display" }, props.content),
      ),
  );
  MathBlock.displayName = "StreamdMathBlock";

  /** Text component — emits literal text content. */
  const Text = memo((props: { readonly content: string }): ReactNode => props.content);
  Text.displayName = "StreamdText";

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

  /** Link component — renders `<a>` with href/title/rel/target. */
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

  /** Image component — renders `<img>` with src/alt/title and meta.attrs. */
  const Image = memo(
    (props: ImageProps): ReactNode =>
      createElement("img", {
        className: cls("img"),
        src: props.src,
        alt: props.alt,
        title: props.title.length > 0 ? props.title : undefined,
        ...props.attrs,
      }),
  );
  Image.displayName = "StreamdImage";

  /** Escape component — emits the escaped character as literal text. */
  const Escape = memo((props: { readonly content: string }): ReactNode => props.content);
  Escape.displayName = "StreamdEscape";

  /**
   * Inline-math component — renders raw TeX in `<code>`.
   *
   * To render formatted math, override `components.math_inline` with a
   * component that calls KaTeX against `token.content`.
   */
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
    hr: Hr,
    table: Table,
    mathBlock: MathBlock,
    text: Text,
    hardbreak: Hardbreak,
    codeSpan: CodeSpan,
    em: Em,
    strong: Strong,
    strikethrough: Strikethrough,
    link: Link,
    image: Image,
    escape: Escape,
    mathInline: MathInline,
  });
}
