/**
 * Accessibility (H11) tests for the React Native renderer.
 *
 * Two testing strategies are used:
 *
 * 1. String-valued props (`accessibilityRole`, `accessibilityLabel`) are
 *    asserted via the static-markup grep pattern already used in
 *    `render.test.tsx`. React preserves camelCase attribute names on
 *    custom elements (tag names with a hyphen, e.g. `rn-view`) and
 *    emits primitive-valued props verbatim.
 *
 * 2. Object-valued props such as `accessibilityState` are dropped by
 *    `renderToStaticMarkup`, so they are verified by directly invoking
 *    the memo-unwrapped `ListItem` function component and inspecting
 *    the returned React element tree for the inner `<Text>` marker
 *    element. This mirrors a React Native Testing Library
 *    `getByRole`/`toHaveAccessibilityState` assertion without requiring
 *    RNTL in Node.
 *
 * @module a11y.test
 */

import { parse } from "@streamd/parser";
import { lightTheme } from "@streamd/tokens";
import {
  type ComponentType,
  createElement,
  type FunctionComponent,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createDefaultComponents } from "./components";
import { renderReactNative } from "./render";
import type { ListItemProps } from "./types";

/** Renders the renderer output under an `<rn-root>` wrapper for grep-able output. */
const markup = (node: ReactNode): string =>
  renderToStaticMarkup(createElement("rn-root", null, node) as ReactNode);

/**
 * Unwraps a `React.memo` exotic component to access the underlying
 * function component. `React.memo(Component)` returns an object whose
 * `.type` field references the wrapped function; we leverage that to
 * invoke the component directly with synthetic props during testing.
 */
const unwrapMemo = <T,>(component: ComponentType<T>): FunctionComponent<T> =>
  (component as unknown as { readonly type: FunctionComponent<T> }).type;

/** Predicate narrowing a ReactNode down to a ReactElement. */
const isReactElement = (node: unknown): node is ReactElement =>
  typeof node === "object" && node !== null && "type" in node && "props" in node;

/** Depth-first iterator yielding every `ReactElement` reachable from `node`. */
function* walkElements(node: ReactNode): Generator<ReactElement> {
  if (Array.isArray(node)) {
    for (const child of node) yield* walkElements(child);
    return;
  }
  if (!isReactElement(node)) return;
  yield node;
  const children = (node.props as { readonly children?: ReactNode }).children;
  if (children === undefined) return;
  yield* walkElements(children);
}

describe("renderReactNative — accessibility (H11)", () => {
  it("heading exposes accessibilityRole=header + accessibilityLabel", () => {
    const html = markup(renderReactNative(parse("# hello\n").tokens));
    expect(html).toContain('accessibilityRole="header"');
    expect(html).toContain('accessibilityLabel="heading level 1"');
  });

  it("heading level propagates into accessibilityLabel for h3", () => {
    const html = markup(renderReactNative(parse("### subsection\n").tokens));
    expect(html).toContain('accessibilityLabel="heading level 3"');
  });

  it("table header cells expose accessibilityRole=header", () => {
    const md = "| a | b | c |\n| --- | --- | --- |\n| 1 | 2 | 3 |\n";
    const html = markup(renderReactNative(parse(md, null, { gfm: true }).tokens));
    const matches = html.match(/accessibilityRole="header"/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });

  it("code block with language exposes accessibilityRole=text + accessibilityLabel", () => {
    const html = markup(renderReactNative(parse("```ts\nlet x = 1;\n```\n").tokens));
    expect(html).toContain('accessibilityRole="text"');
    expect(html).toContain('accessibilityLabel="ts code block"');
  });

  it("code block without language still exposes accessibilityRole=text but omits label", () => {
    const html = markup(renderReactNative(parse("```\nplain\n```\n").tokens));
    expect(html).toContain('accessibilityRole="text"');
    expect(html).not.toContain('accessibilityLabel="');
    expect(html).not.toContain("undefined code");
  });

  it("task-list item exposes accessibilityRole=checkbox on the marker", () => {
    const html = markup(renderReactNative(parse("- [x] done\n", null, { gfm: true }).tokens));
    expect(html).toContain('accessibilityRole="checkbox"');
  });

  it("non-task list items do not expose accessibilityRole=checkbox", () => {
    const html = markup(renderReactNative(parse("- plain\n").tokens));
    expect(html).not.toContain('accessibilityRole="checkbox"');
  });

  it("link exposes accessibilityRole=link on the Pressable", () => {
    const html = markup(renderReactNative(parse("[site](/u)").tokens));
    expect(html).toContain('accessibilityRole="link"');
  });

  it("image sets accessibilityLabel from the alt text", () => {
    const html = markup(renderReactNative(parse("![caption](/img.png)").tokens));
    expect(html).toContain('accessibilityLabel="caption"');
  });

  it("task-list item accessibilityState reflects checked=true / disabled=true", () => {
    const defaults = createDefaultComponents(lightTheme);
    const ListItemFn = unwrapMemo(defaults.listItem);
    const element = ListItemFn({
      checked: true,
      ordered: false,
      start: 1,
      index: 0,
      children: null,
    } as unknown as ListItemProps) as ReactElement;

    const markerProps = Array.from(walkElements(element))
      .map((el) => el.props as Record<string, unknown>)
      .find((props) => props["accessibilityState"] !== undefined);

    expect(markerProps).toBeDefined();
    expect(markerProps?.["accessibilityRole"]).toBe("checkbox");
    expect(markerProps?.["accessibilityState"]).toEqual({ checked: true, disabled: true });
  });

  it("task-list item accessibilityState reflects checked=false when unchecked", () => {
    const defaults = createDefaultComponents(lightTheme);
    const ListItemFn = unwrapMemo(defaults.listItem);
    const element = ListItemFn({
      checked: false,
      ordered: false,
      start: 1,
      index: 0,
      children: null,
    } as unknown as ListItemProps) as ReactElement;

    const markerProps = Array.from(walkElements(element))
      .map((el) => el.props as Record<string, unknown>)
      .find((props) => props["accessibilityState"] !== undefined);

    expect(markerProps?.["accessibilityState"]).toEqual({ checked: false, disabled: true });
  });

  it("non-task list item does not attach accessibilityState to the marker", () => {
    const defaults = createDefaultComponents(lightTheme);
    const ListItemFn = unwrapMemo(defaults.listItem);
    const element = ListItemFn({
      checked: null,
      ordered: false,
      start: 1,
      index: 0,
      children: null,
    } as unknown as ListItemProps) as ReactElement;

    const stateful = Array.from(walkElements(element))
      .map((el) => el.props as Record<string, unknown>)
      .find((props) => props["accessibilityState"] !== undefined);
    expect(stateful).toBeUndefined();
  });

  it("combined fixture surfaces multiple accessibility attributes across components", () => {
    const md =
      "# Title\n\n" +
      "- [x] done\n- [ ] open\n\n" +
      "```ts\nlet x = 1;\n```\n\n" +
      "[ext](https://example.com)\n\n" +
      "| a | b | c |\n| --- | --- | --- |\n| 1 | 2 | 3 |\n";
    const html = markup(renderReactNative(parse(md, null, { gfm: true }).tokens));

    const roleMatches = html.match(/accessibilityRole="[^"]+"/g) ?? [];
    const labelMatches = html.match(/accessibilityLabel="[^"]+"/g) ?? [];
    expect(roleMatches.length).toBeGreaterThanOrEqual(5);
    expect(labelMatches.length).toBeGreaterThanOrEqual(2);
  });
});
