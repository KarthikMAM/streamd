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
  TableToken,
  TextToken,
  Token,
  TokensList,
} from "@streamd/parser";
import type { Plugin } from "@streamd/plugins";
import type { Theme } from "@streamd/tokens";
import type { ComponentType, ReactNode } from "react";

/** Props every component receives — children pre-rendered by the parent. */
export interface BaseProps {
  readonly children?: ReactNode;
}

/** Heading component props. */
export interface HeadingProps extends BaseProps {
  readonly level: 1 | 2 | 3 | 4 | 5 | 6;
  readonly id?: string;
}

/** List component props. */
export interface ListProps extends BaseProps {
  readonly ordered: boolean;
  readonly start: number;
  readonly tight: boolean;
}

/** List item props. */
export interface ListItemProps extends BaseProps {
  readonly checked: boolean | null;
  readonly tight: boolean;
}

/** Code block props. */
export interface CodeBlockProps {
  readonly lang: string;
  readonly info: string;
  readonly content: string;
  /** Pre-rendered HTML from a highlight plugin. When set, renderers emit
   *  this directly instead of the default `<pre><code>` shell. */
  readonly html?: string;
}

/** Code span props. */
export interface CodeSpanProps {
  readonly content: string;
}

/** Link props. */
export interface LinkProps extends BaseProps {
  readonly href: string;
  readonly title: string;
  readonly rel?: string;
  readonly target?: string;
  readonly className?: string;
}

/** Image props. */
export interface ImageProps {
  readonly src: string;
  readonly alt: string;
  readonly title: string;
}

/** Math props. */
export interface MathProps {
  readonly content: string;
}

/** Raw HTML props (block or inline). */
export interface HtmlProps {
  readonly content: string;
}

/** Table props. */
export interface TableProps {
  readonly align: ReadonlyArray<Align>;
  /** Header row — one ReactNode per column. */
  readonly head: ReadonlyArray<ReactNode>;
  /** Body rows — each row is one ReactNode per column. */
  readonly rows: ReadonlyArray<ReadonlyArray<ReactNode>>;
}

/** Complete component override map. Any key omitted falls back to the default. */
export interface Components {
  readonly blockquote?: ComponentType<BaseProps>;
  readonly list?: ComponentType<ListProps>;
  readonly listItem?: ComponentType<ListItemProps>;
  readonly heading?: ComponentType<HeadingProps>;
  readonly paragraph?: ComponentType<BaseProps>;
  readonly codeBlock?: ComponentType<CodeBlockProps>;
  readonly htmlBlock?: ComponentType<HtmlProps>;
  readonly hr?: ComponentType<Record<never, never>>;
  readonly table?: ComponentType<TableProps>;
  readonly mathBlock?: ComponentType<MathProps>;
  readonly text?: ComponentType<{ readonly content: string }>;
  readonly softbreak?: ComponentType<Record<never, never>>;
  readonly hardbreak?: ComponentType<Record<never, never>>;
  readonly codeSpan?: ComponentType<CodeSpanProps>;
  readonly em?: ComponentType<BaseProps>;
  readonly strong?: ComponentType<BaseProps>;
  readonly strikethrough?: ComponentType<BaseProps>;
  readonly link?: ComponentType<LinkProps>;
  readonly image?: ComponentType<ImageProps>;
  readonly htmlInline?: ComponentType<HtmlProps>;
  readonly escape?: ComponentType<{ readonly content: string }>;
  readonly mathInline?: ComponentType<MathProps>;
}

/** Renderer options surfaced through `<StreamdMarkdown>` and `renderReact`. */
export interface RenderReactOptions {
  /** Component overrides. Unset keys use defaults. */
  readonly components?: Components;
  /** Task list checkbox strategy. Default: "disabled". */
  readonly taskListCheckboxes?: "disabled" | "none";
  /** Math rendering strategy. Default: "span-class". */
  readonly math?: "span-class" | "tex-delim" | "none";
  /** CSS class prefix. Default: "streamd". */
  readonly classPrefix?: string;
  /** Plugins applied to the token tree before rendering. Runs in order. */
  readonly plugins?: ReadonlyArray<Plugin>;
}

/** Theme context shape. */
export interface ThemeContextValue {
  readonly theme: Theme;
  readonly classPrefix: string;
}

/** Props for the top-level markdown component. */
export interface StreamdMarkdownProps extends RenderReactOptions {
  /** Markdown source or pre-parsed token list. */
  readonly source?: string;
  readonly tokens?: TokensList;
  /** Parser options. Ignored when `tokens` is provided. */
  readonly parseOptions?: {
    readonly gfm?: boolean;
    readonly math?: boolean;
    readonly tables?: boolean;
    readonly strikethrough?: boolean;
    readonly taskListItems?: boolean;
    readonly autolinks?: boolean;
  };
}

/** Return type for the `useStreamingMarkdown` hook. */
export interface UseStreamingMarkdownResult {
  /** Token list rendered so far. */
  readonly tokens: TokensList;
  /** Stable-count boundary. Tokens 0..stableCount-1 are final. */
  readonly stableCount: number;
  /** Append a chunk of source text. */
  readonly append: (chunk: string) => void;
  /** Replace the full source (resets state). */
  readonly reset: (source?: string) => void;
}

/** Re-export commonly used token types. */
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
  TableToken,
  TextToken,
  Token,
  TokensList,
};
