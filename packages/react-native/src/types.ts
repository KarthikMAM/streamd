/**
 * Public types for @streamd/react-native.
 *
 * @module types
 */
import type {
  Align,
  BlockToken,
  CodeBlockToken,
  CodeSpanToken,
  HeadingToken,
  HtmlBlockToken,
  HtmlInlineToken,
  ImageToken,
  InlineToken,
  LinkToken,
  ListItemToken,
  ListToken,
  MathBlockToken,
  MathInlineToken,
  ParagraphToken,
  StrikethroughToken,
  StrongToken,
  TableToken,
  TextToken,
  Token,
  TokensList,
} from "@streamd/parser";
import type { Plugin } from "@streamd/plugins";
import type { Theme } from "@streamd/tokens";
import type { ComponentType, ReactNode } from "react";

/** Props shared by components that accept rendered children. */
export interface BaseProps {
  readonly children?: ReactNode;
}

/** Props for the heading component. `level` is 1–6 per Markdown's ATX headings. */
export interface HeadingProps extends BaseProps {
  /** ATX heading depth — 1 is the largest, 6 the smallest. */
  readonly level: 1 | 2 | 3 | 4 | 5 | 6;
}

/** Props for an ordered / unordered list container. `tight` mirrors CommonMark tightness. */
export interface ListProps extends BaseProps {
  /** Whether the list uses numeric markers (ordered) or bullets (unordered). */
  readonly ordered: boolean;
  /** Starting number for ordered lists; always 1 for unordered. */
  readonly start: number;
  /** Whether the list is tight (no inter-item blank lines) per CommonMark §5.3. */
  readonly tight: boolean;
}

/** Props for a single list item. `checked` is `null` for non-task items. */
export interface ListItemProps extends BaseProps {
  /** Zero-based position of this item within the parent list. */
  readonly index: number;
  /** Whether the parent list is ordered. */
  readonly ordered: boolean;
  /** Starting number of the parent ordered list. */
  readonly start: number;
  /** Task-list checkbox state: `true`/`false` for tasks, `null` for plain items. */
  readonly checked: boolean | null;
}

/** Props for a fenced code block. `lang` is the first info-string token, `info` is the raw string. */
export interface CodeBlockProps {
  /** Language identifier extracted from the first word of the info string. Empty when absent. */
  readonly lang: string;
  /** Full info string after the opening fence (includes lang + any trailing metadata). */
  readonly info: string;
  /** Raw text content of the code block, without the fences. */
  readonly content: string;
  /**
   * Pre-rendered HTML from a highlight plugin. Present only when a
   * plugin populates `meta.html` on the code-block token.
   *
   * React Native has no equivalent of `dangerouslySetInnerHTML`, so
   * the default component never paints this value; it is surfaced on
   * the type for API parity with `@streamd/react` and so custom
   * `codeBlock` overrides (for example, a WebView-backed implementation)
   * can consume it.
   */
  readonly html?: string;
  /**
   * Opt-in flag that mirrors `@streamd/react`'s
   * `allowDangerousMetaHtml`. Default RN components ignore it — RN has
   * no way to render raw HTML safely — but custom overrides should
   * respect the flag before consuming `props.html`.
   */
  readonly allowDangerousMetaHtml?: boolean;
}

/** Props for inline code span. */
export interface CodeSpanProps {
  /** Raw text content between the backtick delimiters. */
  readonly content: string;
}

/** Props for a link. `onPress` receives the resolved href on tap. */
export interface LinkProps extends BaseProps {
  /** Resolved URL destination of the link. */
  readonly href: string;
  /** Optional title attribute from the markdown link syntax. */
  readonly title: string;
  /** Tap handler — receives `href` as its argument. */
  readonly onPress?: (href: string) => void;
}

/** Props for an image. `alt` is required for accessibility. */
export interface ImageProps {
  /** Image source URL. */
  readonly src: string;
  /** Alternative text — required for screen-reader accessibility. */
  readonly alt: string;
  /** Optional title attribute from the markdown image syntax. */
  readonly title: string;
}

/** Props for math block / inline. `content` is the raw TeX source. */
export interface MathProps {
  /** Raw TeX/LaTeX source string between the math delimiters. */
  readonly content: string;
}

/** Props for a raw HTML block or inline. Renderers typically drop this. */
export interface HtmlProps {
  /** Raw HTML string. RN default components render this as plain text. */
  readonly content: string;
}

/** Props for a GFM table. `head` + each `rows[i]` are pre-rendered React nodes. */
export interface TableProps {
  /** Column alignment array — one entry per column (`"left"`, `"center"`, `"right"`, or `null`). */
  readonly align: ReadonlyArray<Align>;
  /** Pre-rendered header cells — one ReactNode per column. */
  readonly head: ReadonlyArray<ReactNode>;
  /** Body rows — each row is an array of pre-rendered cell ReactNodes. */
  readonly rows: ReadonlyArray<ReadonlyArray<ReactNode>>;
}

/**
 * Override any subset of the default component map. Consumers provide
 * this to `renderReactNative` or `<StreamdMarkdownNative components={…} />`
 * to swap in custom Text / View / Pressable wrappers.
 */
export interface Components {
  /** Custom blockquote container component. */
  readonly blockquote?: ComponentType<BaseProps>;
  /** Custom list container component. */
  readonly list?: ComponentType<ListProps>;
  /** Custom list-item component. */
  readonly listItem?: ComponentType<ListItemProps>;
  /** Custom heading component. */
  readonly heading?: ComponentType<HeadingProps>;
  /** Custom paragraph component. */
  readonly paragraph?: ComponentType<BaseProps>;
  /** Custom fenced/indented code-block component. */
  readonly codeBlock?: ComponentType<CodeBlockProps>;
  /** Custom raw-HTML block component. */
  readonly htmlBlock?: ComponentType<HtmlProps>;
  /** Custom horizontal-rule (thematic break) component. */
  readonly hr?: ComponentType<Record<never, never>>;
  /** Custom GFM table component. */
  readonly table?: ComponentType<TableProps>;
  /** Custom display-math block component. */
  readonly mathBlock?: ComponentType<MathProps>;
  /** Custom plain-text component. */
  readonly text?: ComponentType<{ readonly content: string }>;
  /** Custom soft-break component. */
  readonly softbreak?: ComponentType<Record<never, never>>;
  /** Custom hard-break component. */
  readonly hardbreak?: ComponentType<Record<never, never>>;
  /** Custom inline code-span component. */
  readonly codeSpan?: ComponentType<CodeSpanProps>;
  /** Custom emphasis (italic) component. */
  readonly em?: ComponentType<BaseProps>;
  /** Custom strong (bold) component. */
  readonly strong?: ComponentType<BaseProps>;
  /** Custom strikethrough component. */
  readonly strikethrough?: ComponentType<BaseProps>;
  /** Custom link component. */
  readonly link?: ComponentType<LinkProps>;
  /** Custom image component. */
  readonly image?: ComponentType<ImageProps>;
  /** Custom inline-HTML component. */
  readonly htmlInline?: ComponentType<HtmlProps>;
  /** Custom backslash-escape component. */
  readonly escape?: ComponentType<{ readonly content: string }>;
  /** Custom inline-math component. */
  readonly mathInline?: ComponentType<MathProps>;
}

/** Options accepted by `renderReactNative`. All fields optional. */
export interface RenderReactNativeOptions {
  /** Custom component overrides — merged on top of the default set. */
  readonly components?: Components;
  /** Math rendering mode: `"span-class"` (default), `"tex-delim"`, or `"none"`. */
  readonly math?: "span-class" | "tex-delim" | "none";
  /** Task-list checkbox rendering: `"disabled"` (default) or `"none"`. */
  readonly taskListCheckboxes?: "disabled" | "none";
  /** Global link-press handler — forwarded to every rendered link. */
  readonly onLinkPress?: (href: string) => void;
  /** Theme tokens for styling. Defaults to `lightTheme`. */
  readonly theme?: Theme;
  /** Plugin pipeline applied to the token tree before rendering. */
  readonly plugins?: ReadonlyArray<Plugin>;
  /**
   * Opt-in flag mirroring `@streamd/react`'s `allowDangerousMetaHtml`.
   * Default: `false`.
   *
   * **Security** — React Native has no native way to render raw HTML,
   * so the built-in components ignore the flag. It is forwarded to
   * custom `codeBlock` overrides (for example, a WebView-backed
   * implementation) so authors can opt in to plugin-supplied HTML only
   * when every plugin is trusted.
   */
  readonly allowDangerousMetaHtml?: boolean;
}

/**
 * Props for the top-level `<StreamdMarkdownNative>` component. Accepts
 * either raw `source` (parsed internally) or a pre-parsed `tokens` list.
 */
export interface StreamdMarkdownNativeProps extends RenderReactNativeOptions {
  /** Raw markdown source string. Mutually exclusive with `tokens`. */
  readonly source?: string;
  /** Pre-parsed token list. Mutually exclusive with `source`. */
  readonly tokens?: TokensList;
  /** Parser options forwarded to `parse()` when `source` is provided. */
  readonly parseOptions?: {
    /** Enable GFM extensions (tables, strikethrough, task lists, autolinks). */
    readonly gfm?: boolean;
    /** Enable `$...$` / `$$...$$` math parsing. */
    readonly math?: boolean;
    /** Enable GFM table parsing. */
    readonly tables?: boolean;
    /** Enable `~~...~~` strikethrough parsing. */
    readonly strikethrough?: boolean;
    /** Enable `- [x]` / `- [ ]` task-list item parsing. */
    readonly taskListItems?: boolean;
    /** Enable GFM extended autolink detection. */
    readonly autolinks?: boolean;
  };
}

/**
 * Minimal snapshot of a parse result — the pair that the
 * `useStreamingMarkdown` hook memoises between chunks.
 */
export interface ParsedMarkdownSnapshot {
  /** Full token list produced by the most recent parse call. */
  readonly tokens: TokensList;
  /** Number of leading tokens that are finalized and will not change. */
  readonly stableCount: number;
}

/** Return value of the `useStreamingMarkdown` hook. */
export interface UseStreamingMarkdownResult {
  /** Token list rendered so far. */
  readonly tokens: TokensList;
  /** Stable-count boundary. Tokens `0..stableCount-1` are final. */
  readonly stableCount: number;
  /** Append a chunk of source text. Throws on non-string input. */
  readonly append: (chunk: string) => void;
  /** Replace the full source (resets parser state). */
  readonly reset: (source?: string) => void;
}

/** Re-exported parser token types for consumer convenience. */
export type {
  Align,
  BlockToken,
  CodeBlockToken,
  CodeSpanToken,
  HeadingToken,
  HtmlBlockToken,
  HtmlInlineToken,
  ImageToken,
  InlineToken,
  LinkToken,
  ListItemToken,
  ListToken,
  MathBlockToken,
  MathInlineToken,
  ParagraphToken,
  StrikethroughToken,
  StrongToken,
  TableToken,
  TextToken,
  Token,
  TokensList,
};
