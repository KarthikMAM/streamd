/**
 * Public types for @streamd/react.
 *
 * @module types
 */
import type {
  Align,
  BlockToken,
  CodeBlockToken,
  CodeSpanToken,
  HeadingToken,
  HighlightData,
  ImageToken,
  InlineToken,
  LinkToken,
  ListItemToken,
  ListToken,
  MathBlockToken,
  MathInlineToken,
  ParagraphToken,
  TableToken,
  TextToken,
  ThemedSegment,
  Token,
  TokenMeta,
  TokensList,
  TokenTypeValue,
} from "@streamd/parser";
import type { Plugin } from "@streamd/plugins";
import type { Theme } from "@streamd/tokens";
import type { ComponentType, ReactNode } from "react";

/** Props every component receives — children pre-rendered by the parent. */
export interface BaseProps {
  /** Pre-rendered child nodes. Undefined when the token has no children. */
  readonly children?: ReactNode;
}

/** Heading component props. */
export interface HeadingProps extends BaseProps {
  /** Heading depth 1–6 corresponding to `<h1>`–`<h6>`. */
  readonly level: 1 | 2 | 3 | 4 | 5 | 6;
  /** Optional anchor id derived from heading text via a slug plugin. */
  readonly id?: string;
}

/** List component props. */
export interface ListProps extends BaseProps {
  /** `true` for `<ol>`, `false` for `<ul>`. */
  readonly ordered: boolean;
  /** Starting number for ordered lists. Always `1` for unordered. */
  readonly start: number;
  /** Whether the list is tight (items rendered without `<p>` wrappers). */
  readonly tight: boolean;
}

/** List item props. */
export interface ListItemProps extends BaseProps {
  /** GFM task-list state: `true`/`false` for checked/unchecked, `null` for non-task items. */
  readonly checked: boolean | null;
  /** Whether the parent list is tight — affects paragraph wrapping of children. */
  readonly tight: boolean;
}

/** Code block props. */
export interface CodeBlockProps {
  /** Language identifier from the info string. */
  readonly lang: string;
  /** Raw code content. */
  readonly content: string;
  /** Structured highlight data from plugin-shiki, if present. */
  readonly highlight?: HighlightData;
}

/** Code span props. */
export interface CodeSpanProps {
  /** Literal text content of the inline code (backtick-delimited). */
  readonly content: string;
}

/** Link props. */
export interface LinkProps extends BaseProps {
  /** Resolved link destination URL. */
  readonly href: string;
  /** Title attribute text. Empty string when no title was specified. */
  readonly title: string;
  /** `rel` attribute value injected by plugins (e.g. `"noopener noreferrer"`). */
  readonly rel?: string;
  /** `target` attribute value (e.g. `"_blank"`) injected by plugins. */
  readonly target?: string;
  /** Additional CSS class name(s) injected by plugins. */
  readonly className?: string;
}

/** Image props. */
export interface ImageProps {
  /** Image source URL. */
  readonly src: string;
  /** Alt text extracted from the image description. */
  readonly alt: string;
  /** Title attribute text. Empty string when no title was specified. */
  readonly title: string;
  /** Additional attributes from meta.attrs. */
  readonly attrs?: Readonly<Record<string, string>>;
}

/** Math props (block or inline). */
export interface MathProps {
  /** Raw TeX/LaTeX content between delimiters. */
  readonly content: string;
}

/** Table props. */
export interface TableProps {
  /** Column alignment array — one entry per column (`"left"`, `"right"`, `"center"`, or `null`). */
  readonly align: ReadonlyArray<Align>;
  /** Header row — one ReactNode per column. */
  readonly head: ReadonlyArray<ReactNode>;
  /** Body rows — each row is one ReactNode per column. */
  readonly rows: ReadonlyArray<ReadonlyArray<ReactNode>>;
}

/**
 * Token-type-keyed component override map.
 *
 * Each key is a `TokenTypeValue` string literal. The component receives
 * the full token as `token` and pre-rendered children (for container tokens).
 * Any key omitted falls back to the built-in default component.
 */
export type ReactComponents = {
  readonly [K in TokenTypeValue]?: ComponentType<{
    readonly token: TokenByType<K>;
    readonly children?: ReactNode;
  }>;
};

/**
 * Maps a token type string literal to its concrete token interface.
 *
 * Used by `ReactComponents` to type-safely associate override components
 * with the token they render.
 */
export type TokenByType<K extends TokenTypeValue> = Extract<Token, { type: K }>;

/** Renderer options surfaced through `<StreamdMarkdown>` and `renderReact`. */
export interface RenderReactOptions {
  /** Token-type-keyed component overrides. Unset keys use defaults. */
  readonly components?: ReactComponents;
  /** Task list checkbox strategy. `"disabled"` renders disabled checkboxes; `"none"` omits them. Default: `"disabled"`. */
  readonly taskListCheckboxes?: "disabled" | "none";
  /** Math rendering strategy. `"span-class"` wraps in a classed element; `"tex-delim"` emits raw TeX delimiters; `"none"` suppresses. Default: `"span-class"`. */
  readonly math?: "span-class" | "tex-delim" | "none";
  /** CSS class prefix applied to all generated class names. Default: `"streamd"`. */
  readonly classPrefix?: string;
  /** Plugins applied to the token tree before rendering. Runs in array order. */
  readonly plugins?: ReadonlyArray<Plugin>;
}

/** Theme context shape. */
export interface ThemeContextValue {
  /** Active design-token theme (light, dark, or custom). */
  readonly theme: Theme;
  /** CSS class prefix used by all default components. */
  readonly classPrefix: string;
}

/** Props for the top-level markdown component. */
export interface StreamdMarkdownProps extends RenderReactOptions {
  /** Raw markdown source string. Mutually exclusive with `tokens`. */
  readonly source?: string;
  /** Pre-parsed token list. When provided, `source` and `parseOptions` are ignored. */
  readonly tokens?: TokensList;
  /** Parser options forwarded to `parse()`. Ignored when `tokens` is provided. */
  readonly parseOptions?: {
    /** Enable GFM extensions (tables, strikethrough, task lists, autolinks). */
    readonly gfm?: boolean;
    /** Enable `$…$` / `$$…$$` math parsing. */
    readonly math?: boolean;
    /** Enable GFM table parsing. */
    readonly tables?: boolean;
    /** Enable `~~…~~` strikethrough parsing. */
    readonly strikethrough?: boolean;
    /** Enable `- [x]` / `- [ ]` task-list item parsing. */
    readonly taskListItems?: boolean;
    /** Enable GFM extended autolink detection. */
    readonly autolinks?: boolean;
  };
}

/** Return type for the `useStreamingMarkdown` hook. */
export interface UseStreamingMarkdownResult {
  /** Full token list rendered so far (stable + speculative). */
  readonly tokens: TokensList;
  /** Stable-count boundary. Tokens `0..stableCount-1` are finalized and will not change. */
  readonly stableCount: number;
  /** Append a chunk of source text. Triggers an incremental re-parse via `startTransition`. */
  readonly append: (chunk: string) => void;
  /** Replace the full source and reset parser state. Pass `""` or omit to clear. */
  readonly reset: (source?: string) => void;
}

/**
 * Minimal snapshot of a parse result — the pair that the
 * `useStreamingMarkdown` hook memoises between chunks.
 */
export interface ParsedMarkdownSnapshot {
  /** Token list from the most recent parse. */
  readonly tokens: TokensList;
  /** Number of leading tokens guaranteed stable (will not change on subsequent appends). */
  readonly stableCount: number;
}

/** Re-export commonly used token types. */
export type {
  Align,
  BlockToken,
  CodeBlockToken,
  CodeSpanToken,
  HeadingToken,
  HighlightData,
  ImageToken,
  InlineToken,
  LinkToken,
  ListItemToken,
  ListToken,
  MathBlockToken,
  MathInlineToken,
  ParagraphToken,
  TableToken,
  TextToken,
  ThemedSegment,
  Token,
  TokenMeta,
  TokensList,
  TokenTypeValue,
};
