/**
 * @streamd/react — React renderer and streaming hook for streamd token trees.
 *
 * @module index
 */

export { createDefaultComponents } from "./components";
export { StreamdMarkdown, useStreamingMarkdown } from "./markdown";
export { renderReact } from "./render";
export type { ThemeProviderProps } from "./theme";
export { ThemeProvider, useStreamdTheme } from "./theme";
export type {
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
  ParsedMarkdownSnapshot,
  RenderReactOptions,
  StreamdMarkdownProps,
  TableProps,
  ThemeContextValue,
  UseStreamingMarkdownResult,
} from "./types";
export type { StreamdReactArgumentErrorFields } from "./validation";
export { StreamdReactArgumentError } from "./validation";
