/**
 * @streamd/react-native — React Native renderer for streamd token trees.
 *
 * @module index
 */

/** Factory that builds the default component set for a given theme. */
export { createDefaultComponents } from "./components";
/** Top-level component and streaming hook for rendering markdown. */
export { StreamdMarkdownNative, useStreamingMarkdown } from "./markdown";
/** Imperative render function — converts a token tree to React Native nodes. */
export { renderReactNative } from "./render";
/** Theme context value and provider prop types. */
export type { ThemeContextValue, ThemeProviderProps } from "./theme";
/** Theme context provider and consumer hook. */
export { ThemeProvider, useStreamdTheme } from "./theme";
/** Public prop and option types for the renderer and components. */
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
  RenderReactNativeOptions,
  StreamdMarkdownNativeProps,
  TableProps,
  UseStreamingMarkdownResult,
} from "./types";
/** Argument-error field type for programmatic error handling. */
export type { StreamdReactNativeArgumentErrorFields } from "./validation";
/** Argument-error class thrown on public-API contract violations. */
export { StreamdReactNativeArgumentError } from "./validation";
