/**
 * Default React Native components — one per token type.
 *
 * All components consume the theme via `useStreamdTheme()` for styling.
 * The RN renderer uses `Text` for inline content and `View` for block
 * layout. Text inside a <Text> can only contain other <Text> nodes, so
 * inline tokens route through `<Text>`.
 *
 * Every default component is wrapped in `React.memo` so streaming
 * re-renders skip unchanged subtrees. Inline default components close
 * only over `theme` / `styles`, so prop-based diffs drive every change.
 *
 * @module components
 */
import type { Theme } from "@streamd/tokens";
import { createElement, memo, type ReactNode } from "react";
import { Pressable, Image as RNImage, StyleSheet, Text, View } from "react-native";
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

/** Default image height in density-independent pixels when no explicit size is provided. */
const IMAGE_DEFAULT_HEIGHT = 200;

/** Props passed to the list-item marker `<Text>` element. */
interface ListMarkerTextProps {
  /** Inline style applied to the marker text — color, font size, and fixed width. */
  readonly style: { readonly color: string; readonly fontSize: number; readonly width: number };
  /** Accessibility role — set to `"checkbox"` for GFM task-list items. */
  readonly accessibilityRole?: "checkbox";
  /** Accessibility state — reflects checked/disabled for task-list checkboxes. */
  readonly accessibilityState?: { readonly checked: boolean; readonly disabled: boolean };
}

/**
 * Build the default component set bound to a specific theme.
 *
 * Tables and code blocks use scrollable containers on native; consumers
 * that need fine-grained scroll behaviour should override.
 *
 * The returned map defines a component for every key in {@link Components},
 * so the return type is narrowed to `Required<Components>`: consumers can
 * access any field without a null check.
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

  /** List-item component — renders bullet/number/checkbox + content.
   *
   *  Accessibility (H11): when the item is a GFM task-list entry
   *  (`props.checked !== null`) the bullet `<Text>` adopts the native
   *  checkbox role via `accessibilityRole="checkbox"` and reflects its
   *  state through `accessibilityState={{ checked, disabled: true }}`.
   *  Non-task items keep the plain marker text — iOS VoiceOver / Talkback
   *  announce the character verbatim which is the correct behaviour for
   *  a simple list bullet.
   */
  const ListItem = memo((props: ListItemProps): ReactNode => {
    const isTask = props.checked !== null;
    const bullet = resolveListItemBullet(props);
    const markerProps: ListMarkerTextProps = isTask
      ? {
          style: styles.listMarker,
          accessibilityRole: "checkbox",
          accessibilityState: { checked: props.checked === true, disabled: true },
        }
      : { style: styles.listMarker };
    return createElement(
      View,
      { style: styles.listItem },
      createElement(Text, markerProps, bullet),
      createElement(View, { style: styles.listItemContent }, props.children),
    );
  });
  ListItem.displayName = "StreamdNativeListItem";

  /** Heading component — renders themed `<Text>`; styling depends on `props.level`.
   *
   *  Accessibility (H11): React Native has no `aria-level` analogue, so
   *  the component surfaces the heading depth via `accessibilityLabel`
   *  ("heading level N") and uses `accessibilityRole="header"` to cue
   *  VoiceOver / Talkback to announce the node as a heading.
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
   * Code-block component — renders `<View>` with monospaced `<Text>`
   * content.
   *
   * React Native has no safe equivalent of `dangerouslySetInnerHTML`,
   * so `props.html` is always ignored by the default component.
   * `props.allowDangerousMetaHtml` is accepted for API parity with
   * `@streamd/react`; custom overrides that implement their own HTML
   * rendering (for example, via `WebView`) should honour the flag.
   *
   * Accessibility (H11): the wrapping `<View>` carries
   * `accessibilityRole="text"` so screen readers announce the code as a
   * contiguous text region rather than an unrelated grouping. When a
   * language is set, `accessibilityLabel` is populated with
   * `"{lang} code block"` so the reader announces what flavour of
   * code is presented; without a language the label is omitted to avoid
   * the "undefined code block" announcement footgun.
   */
  const CodeBlock = memo((props: CodeBlockProps): ReactNode => {
    const hasLang = props.lang.length > 0;
    const viewProps: Record<string, unknown> = {
      style: styles.codeBlock,
      accessibilityRole: "text",
    };
    if (hasLang) viewProps["accessibilityLabel"] = `${props.lang} code block`;
    return createElement(
      View,
      viewProps,
      createElement(Text, { style: styles.codeText }, props.content),
    );
  });
  CodeBlock.displayName = "StreamdNativeCodeBlock";

  /** HTML-block component — renders the raw HTML string inside themed `<Text>`. */
  const HtmlBlock = memo(
    (props: HtmlProps): ReactNode =>
      createElement(Text, { style: styles.htmlFallback }, props.content),
  );
  HtmlBlock.displayName = "StreamdNativeHtmlBlock";

  /** Thematic-break component — renders a thin `<View>` rule. */
  const Hr = memo((): ReactNode => createElement(View, { style: styles.hr }));
  Hr.displayName = "StreamdNativeHr";

  /** Table component — renders a header row and body rows as stacked `<View>`s.
   *
   *  Accessibility (H11): each header cell `<View>` carries
   *  `accessibilityRole="header"` so assistive tech announces the column
   *  label before the associated data cells, matching the implicit
   *  `<th scope="col">` semantics of the HTML renderer.
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

  /** Display-math component — rendered as a pre-formatted `<View>`. */
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

  /** Soft-break component — emits a newline character. */
  const Softbreak = memo((): ReactNode => "\n");
  Softbreak.displayName = "StreamdNativeSoftbreak";

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

  /** Link component — renders `<Pressable>` with inline-text children; invokes `onPress(href)`. */
  const Link = memo((props: LinkProps): ReactNode => {
    /** Press handler for the surrounding Link — forwards to `props.onPress(href)` when set. */
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

  /** Inline-HTML component — renders the raw HTML string inside themed `<Text>`. */
  const HtmlInline = memo(
    (props: HtmlProps): ReactNode =>
      createElement(Text, { style: styles.htmlFallback }, props.content),
  );
  HtmlInline.displayName = "StreamdNativeHtmlInline";

  /** Escape component — emits the escaped character as literal text. */
  const Escape = memo((props: { readonly content: string }): ReactNode => props.content);
  Escape.displayName = "StreamdNativeEscape";

  /** Inline-math component — renders TeX inside monospaced `<Text>`. */
  const MathInline = memo(
    (props: MathProps): ReactNode => createElement(Text, { style: styles.codeSpan }, props.content),
  );
  MathInline.displayName = "StreamdNativeMathInline";

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
    text: TextNode,
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

/**
 * Resolves the stylesheet entry for a given heading level.
 *
 * @param styles - Compiled stylesheet from {@link buildStyles}.
 * @param level - Heading depth (1–6). Values outside 1–5 fall through to h6.
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

/** Unicode bullet character followed by a space — marker for unordered list items. */
const LIST_MARKER_BULLET = "\u2022 ";
/** Unicode ballot-box-with-check followed by a space — marker for checked task-list items. */
const LIST_MARKER_CHECKED = "\u2611 ";
/** Unicode ballot-box followed by a space — marker for unchecked task-list items. */
const LIST_MARKER_UNCHECKED = "\u2610 ";

/**
 * Pick the marker string for a list item: number for ordered lists,
 * plain bullet for unordered, or checkbox for GFM task-list items.
 *
 * Decomposed from the original nested ternary so each branch reads as a
 * single condition — per `function-design.md §3` Condition Decomposition.
 *
 * @param props List item props — only `ordered`, `start`, `index`, `checked` are consulted.
 * @returns Marker text suitable for the list-item bullet `<Text>`.
 */
function resolveListItemBullet(props: ListItemProps): string {
  if (props.ordered) {
    return `${props.start + props.index}. `;
  }
  const isTask = props.checked !== null;
  if (!isTask) {
    return LIST_MARKER_BULLET;
  }
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
    htmlFallback: { color: c.textMuted, fontFamily: tp.codeFontFamily },
  });
}
