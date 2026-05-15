/**
 * Default React Native components — one per token type.
 *
 * All components consume the theme via `useStreamdTheme()` for styling.
 * The RN renderer uses `Text` for inline content and `View` for block
 * layout. Text inside a <Text> can only contain other <Text> nodes, so
 * inline tokens route through `<Text>`.
 *
 * Every default component is wrapped in `React.memo` so streaming
 * re-renders skip unchanged subtrees.
 *
 * @module components
 */
import type { HighlightData, ThemedSegment } from "@streamd/parser";
import type { Theme } from "@streamd/tokens";
import { createElement, memo, type ReactNode } from "react";
import { Pressable, Image as RNImage, StyleSheet, Text, View } from "react-native";
import type {
  BaseProps,
  CodeBlockProps,
  CodeSpanProps,
  Components,
  HeadingProps,
  ImageProps,
  LinkProps,
  ListItemProps,
  ListProps,
  MathProps,
  TableProps,
} from "./types";

/** Default image height in density-independent pixels when no explicit size is provided. */
const IMAGE_DEFAULT_HEIGHT = 200;

/**
 * Build the default component set bound to a specific theme.
 *
 * @param theme - Active theme.
 * @returns Frozen `Required<Components>` map.
 */
export function createDefaultComponents(theme: Theme): Required<Components> {
  const styles = buildStyles(theme);

  /** Blockquote component — renders a bordered `<View>`. */
  const Blockquote = memo(
    (props: BaseProps): ReactNode =>
      createElement(View, { style: styles.blockquote }, props.children),
  );
  Blockquote.displayName = "StreamdNativeBlockquote";

  /** List component — renders a vertical `<View>` container. */
  const List = memo(
    (props: ListProps): ReactNode => createElement(View, { style: styles.list }, props.children),
  );
  List.displayName = "StreamdNativeList";

  /**
   * List-item component — renders bullet/number/checkbox + content.
   *
   * Accessibility: when the item is a GFM task-list entry the bullet
   * `<Text>` adopts `accessibilityRole="checkbox"`.
   */
  const ListItem = memo((props: ListItemProps): ReactNode => {
    const isTask = props.checked !== null;
    const bullet = resolveListItemBullet(props);
    const markerProps: Record<string, unknown> = { style: styles.listMarker };
    if (isTask) {
      markerProps["accessibilityRole"] = "checkbox";
      markerProps["accessibilityState"] = { checked: props.checked === true, disabled: true };
    }
    return createElement(
      View,
      { style: styles.listItem },
      createElement(Text, markerProps, bullet),
      createElement(View, { style: styles.listItemContent }, props.children),
    );
  });
  ListItem.displayName = "StreamdNativeListItem";

  /**
   * Heading component — renders themed `<Text>` with `accessibilityRole="header"`.
   */
  const Heading = memo(
    (props: HeadingProps): ReactNode =>
      createElement(
        Text,
        {
          style: headingStyle(styles, props.level),
          accessibilityRole: "header",
          accessibilityLabel: `heading level ${props.level}`,
        },
        props.children,
      ),
  );
  Heading.displayName = "StreamdNativeHeading";

  /** Paragraph component — renders themed `<Text>`. */
  const Paragraph = memo(
    (props: BaseProps): ReactNode =>
      createElement(Text, { style: styles.paragraph }, props.children),
  );
  Paragraph.displayName = "StreamdNativeParagraph";

  /**
   * Code-block component — renders `<View>` with monospaced `<Text>`.
   *
   * When `props.highlight` is populated (by plugin-shiki), renders each
   * line as a `<View>` row containing per-segment `<Text>` nodes with
   * color, fontWeight, fontStyle, and textDecorationLine styles.
   * Otherwise renders plain monospace text.
   */
  const CodeBlock = memo((props: CodeBlockProps): ReactNode => {
    const hasLang = props.lang.length > 0;
    const viewProps: Record<string, unknown> = {
      style: styles.codeBlock,
      accessibilityRole: "text",
    };
    if (hasLang) viewProps["accessibilityLabel"] = `${props.lang} code block`;

    if (props.highlight) {
      return createElement(View, viewProps, ...renderHighlightLines(props.highlight, styles));
    }

    return createElement(
      View,
      viewProps,
      createElement(Text, { style: styles.codeText }, props.content),
    );
  });
  CodeBlock.displayName = "StreamdNativeCodeBlock";

  /** Thematic-break component — renders a thin `<View>` rule. */
  const Hr = memo((): ReactNode => createElement(View, { style: styles.hr }));
  Hr.displayName = "StreamdNativeHr";

  /**
   * Table component — renders a header row and body rows as stacked `<View>`s.
   * Header cells carry `accessibilityRole="header"`.
   */
  const Table = memo((props: TableProps): ReactNode => {
    const header = createElement(
      View,
      { style: styles.tableRow },
      props.head.map((cell, i) =>
        createElement(
          View,
          { key: i, style: styles.tableCellHeader, accessibilityRole: "header" },
          createElement(Text, { style: styles.tableCellHeaderText }, cell),
        ),
      ),
    );
    const body = props.rows.map((row, r) =>
      createElement(
        View,
        { key: r, style: styles.tableRow },
        row.map((cell, c) =>
          createElement(
            View,
            { key: c, style: styles.tableCell },
            createElement(Text, { style: styles.tableCellText }, cell),
          ),
        ),
      ),
    );
    return createElement(View, { style: styles.table }, header, ...body);
  });
  Table.displayName = "StreamdNativeTable";

  /**
   * Display-math component — renders raw TeX in monospace `<Text>`.
   *
   * Consumers wanting KaTeX (web via react-native-web) or MathJax
   * (native via react-native-svg) override `components.math_block`.
   */
  const MathBlock = memo(
    (props: MathProps): ReactNode =>
      createElement(
        View,
        { style: styles.codeBlock },
        createElement(Text, { style: styles.codeText }, props.content),
      ),
  );
  MathBlock.displayName = "StreamdNativeMathBlock";

  /** Text component — emits literal text content. */
  const TextNode = memo((props: { readonly content: string }): ReactNode => props.content);
  TextNode.displayName = "StreamdNativeText";

  /** Hard-break component — emits a newline character. */
  const Hardbreak = memo((): ReactNode => "\n");
  Hardbreak.displayName = "StreamdNativeHardbreak";

  /** Code-span component — renders monospaced inline `<Text>`. */
  const CodeSpan = memo(
    (props: CodeSpanProps): ReactNode =>
      createElement(Text, { style: styles.codeSpan }, props.content),
  );
  CodeSpan.displayName = "StreamdNativeCodeSpan";

  /** Emphasis component — renders italic `<Text>`. */
  const Em = memo(
    (props: BaseProps): ReactNode => createElement(Text, { style: styles.em }, props.children),
  );
  Em.displayName = "StreamdNativeEm";

  /** Strong-emphasis component — renders bold `<Text>`. */
  const Strong = memo(
    (props: BaseProps): ReactNode => createElement(Text, { style: styles.strong }, props.children),
  );
  Strong.displayName = "StreamdNativeStrong";

  /** Strikethrough component — renders struck-through `<Text>`. */
  const Strikethrough = memo(
    (props: BaseProps): ReactNode =>
      createElement(Text, { style: styles.strikethrough }, props.children),
  );
  Strikethrough.displayName = "StreamdNativeStrikethrough";

  /** Link component — renders `<Pressable>` with inline-text children. */
  const Link = memo((props: LinkProps): ReactNode => {
    const handlePress = (): void => {
      if (props.onPress) props.onPress(props.href);
    };
    return createElement(
      Pressable,
      { onPress: handlePress, accessibilityRole: "link" },
      createElement(Text, { style: styles.link }, props.children),
    );
  });
  Link.displayName = "StreamdNativeLink";

  /** Image component — renders a native `<Image>` sized by the theme. */
  const Image = memo(
    (props: ImageProps): ReactNode =>
      createElement(RNImage, {
        source: { uri: props.src },
        accessibilityLabel: props.alt,
        style: styles.image,
      }),
  );
  Image.displayName = "StreamdNativeImage";

  /** Escape component — emits the escaped character as literal text. */
  const Escape = memo((props: { readonly content: string }): ReactNode => props.content);
  Escape.displayName = "StreamdNativeEscape";

  /**
   * Inline-math component — renders TeX inside monospaced `<Text>`.
   *
   * Consumers wanting KaTeX override `components.math_inline`.
   */
  const MathInline = memo(
    (props: MathProps): ReactNode => createElement(Text, { style: styles.codeSpan }, props.content),
  );
  MathInline.displayName = "StreamdNativeMathInline";

  return Object.freeze({
    blockquote: Blockquote,
    list: List,
    list_item: ListItem,
    heading: Heading,
    paragraph: Paragraph,
    code_block: CodeBlock,
    hr: Hr,
    table: Table,
    math_block: MathBlock,
    text: TextNode,
    hardbreak: Hardbreak,
    code_span: CodeSpan,
    em: Em,
    strong: Strong,
    strikethrough: Strikethrough,
    link: Link,
    image: Image,
    escape: Escape,
    math_inline: MathInline,
  });
}

/**
 * Renders highlight data as an array of line `<View>` elements, each
 * containing per-segment `<Text>` nodes with themed styles.
 *
 * @param highlight - Structured highlight data from plugin-shiki.
 * @param styles - Compiled stylesheet.
 * @returns Array of React nodes, one per line.
 */
function renderHighlightLines(
  highlight: HighlightData,
  styles: ReturnType<typeof buildStyles>,
): Array<ReactNode> {
  const lines = new Array<ReactNode>(highlight.lines.length);
  for (let i = 0; i < highlight.lines.length; i++) {
    const segments = highlight.lines[i];
    const spans = new Array<ReactNode>(segments.length);
    for (let j = 0; j < segments.length; j++) {
      spans[j] = createElement(
        Text,
        { key: j, style: segmentStyle(styles, segments[j]) },
        segments[j].text,
      );
    }
    lines[i] = createElement(View, { key: i, style: styles.highlightLine }, ...spans);
  }
  return lines;
}

/**
 * Builds a style object for a single themed segment.
 *
 * @param styles - Compiled stylesheet for base code text.
 * @param segment - The themed segment with optional color/bold/italic/underline.
 * @returns Inline style object for the segment `<Text>`.
 */
function segmentStyle(
  styles: ReturnType<typeof buildStyles>,
  segment: ThemedSegment,
): Record<string, unknown> {
  const base: Record<string, unknown> = { ...styles.codeText };
  if (segment.color) base["color"] = segment.color;
  if (segment.bold) base["fontWeight"] = "700";
  if (segment.italic) base["fontStyle"] = "italic";
  if (segment.underline) base["textDecorationLine"] = "underline";
  return base;
}

/**
 * Resolves the stylesheet entry for a given heading level.
 *
 * @param styles - Compiled stylesheet from {@link buildStyles}.
 * @param level - Heading depth (1–6).
 * @returns The style object for the resolved heading level.
 */
function headingStyle(
  styles: ReturnType<typeof buildStyles>,
  level: number,
): { fontSize: number; fontWeight: "700"; color: string; marginVertical: number } {
  switch (level) {
    case 1:
      return styles.heading1;
    case 2:
      return styles.heading2;
    case 3:
      return styles.heading3;
    case 4:
      return styles.heading4;
    case 5:
      return styles.heading5;
    default:
      return styles.heading6;
  }
}

/** Unicode bullet character followed by a space. */
const LIST_MARKER_BULLET = "\u2022 ";
/** Unicode ballot-box-with-check followed by a space. */
const LIST_MARKER_CHECKED = "\u2611 ";
/** Unicode ballot-box followed by a space. */
const LIST_MARKER_UNCHECKED = "\u2610 ";

/**
 * Pick the marker string for a list item.
 *
 * @param props List item props.
 * @returns Marker text suitable for the list-item bullet `<Text>`.
 */
function resolveListItemBullet(props: ListItemProps): string {
  if (props.ordered) return `${props.start + props.index}. `;
  const isTask = props.checked !== null;
  if (!isTask) return LIST_MARKER_BULLET;
  return props.checked === true ? LIST_MARKER_CHECKED : LIST_MARKER_UNCHECKED;
}

/**
 * Compiles a React Native StyleSheet from the active theme tokens.
 *
 * @param theme - Theme providing colors, spacing, typography, and radii.
 * @returns Frozen StyleSheet containing all component styles.
 */
function buildStyles(theme: Theme) {
  const sp = theme.spacing;
  const tp = theme.typography;
  const c = theme.colors;

  /**
   * Produces a heading style object for the given font size.
   *
   * @param size - Font size in density-independent pixels.
   * @returns Style record for an ATX heading at that size.
   */
  const heading = (
    size: number,
  ): { fontSize: number; fontWeight: "700"; color: string; marginVertical: number } => ({
    fontSize: size,
    fontWeight: "700",
    color: c.text,
    marginVertical: sp.sm,
  });

  return StyleSheet.create({
    paragraph: {
      color: c.text,
      fontSize: tp.fontSizeBase,
      lineHeight: tp.fontSizeBase * tp.lineHeight,
      marginVertical: sp.sm,
    },
    heading1: heading(tp.headingScale[0]),
    heading2: heading(tp.headingScale[1]),
    heading3: heading(tp.headingScale[2]),
    heading4: heading(tp.headingScale[3]),
    heading5: heading(tp.headingScale[4]),
    heading6: heading(tp.headingScale[5]),
    blockquote: {
      borderLeftWidth: 4,
      borderLeftColor: c.blockquoteAccent,
      paddingLeft: sp.md,
      marginVertical: sp.sm,
    },
    list: { marginVertical: sp.sm, paddingLeft: sp.sm },
    listItem: { flexDirection: "row", alignItems: "flex-start", marginVertical: sp.xs },
    listMarker: { color: c.textMuted, fontSize: tp.fontSizeBase, width: sp.lg },
    listItemContent: { flex: 1 },
    codeBlock: {
      backgroundColor: c.preBackground,
      borderRadius: theme.radii.md,
      padding: sp.md,
      marginVertical: sp.sm,
    },
    codeText: {
      fontFamily: tp.codeFontFamily,
      color: c.text,
      fontSize: tp.fontSizeSm,
      lineHeight: tp.fontSizeSm * tp.codeLineHeight,
    },
    highlightLine: { flexDirection: "row", flexWrap: "wrap" },
    hr: { borderBottomWidth: 1, borderBottomColor: c.border, marginVertical: sp.lg },
    table: { borderWidth: 1, borderColor: c.border, marginVertical: sp.sm },
    tableRow: { flexDirection: "row" },
    tableCellHeader: {
      flex: 1,
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderColor: c.border,
      padding: sp.sm,
      backgroundColor: c.codeBackground,
    },
    tableCell: {
      flex: 1,
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderColor: c.border,
      padding: sp.sm,
    },
    tableCellHeaderText: { color: c.text, fontWeight: "700" },
    tableCellText: { color: c.text },
    codeSpan: {
      fontFamily: tp.codeFontFamily,
      backgroundColor: c.codeBackground,
      color: c.text,
      fontSize: tp.fontSizeSm,
    },
    em: { fontStyle: "italic", color: c.emphasis },
    strong: { fontWeight: "700", color: c.strong },
    strikethrough: { textDecorationLine: "line-through", color: c.textMuted },
    link: { color: c.link, textDecorationLine: "underline" },
    image: { width: "100%", height: IMAGE_DEFAULT_HEIGHT, resizeMode: "contain" },
  });
}
