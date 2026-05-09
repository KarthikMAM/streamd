/**
 * @streamd/react — React renderer and streaming hook for streamd token trees.
 *
 * @module index
 */

export { createDefaultComponents, type DefaultComponents } from "./components";
export { StreamdMarkdown, useStreamingMarkdown } from "./markdown";
export { MemoBlock } from "./memo-block";
export { renderReact } from "./render";
export type { ThemeProviderProps } from "./theme";
export { ThemeProvider, useStreamdTheme } from "./theme";
export type {
  BaseProps,
  CodeBlockProps,
  CodeSpanProps,
  HeadingProps,
  HighlightData,
  ImageProps,
  LinkProps,
  ListItemProps,
  ListProps,
  MathProps,
  ParsedMarkdownSnapshot,
  ReactComponents,
  RenderReactOptions,
  StreamdMarkdownProps,
  TableProps,
  ThemeContextValue,
  ThemedSegment,
  Token,
  TokenByType,
  TokenMeta,
  TokensList,
  TokenTypeValue,
  UseStreamingMarkdownResult,
} from "./types";
export type { StreamdReactArgumentErrorFields } from "./validation";
export { StreamdReactArgumentError } from "./validation";
