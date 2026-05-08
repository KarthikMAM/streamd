/**
 * Unit tests for the React theme context — `ThemeProvider` + `useStreamdTheme`.
 *
 * Uses `renderToStaticMarkup` so tests run in Node without JSDOM,
 * matching the pattern established by `render.test.tsx`. A tiny
 * `Consumer` component exercises `useStreamdTheme` inside the provider
 * tree and dumps the observed values into markup that tests can grep.
 *
 * Uses JSX syntax for `ThemeProvider` because its `ThemeProviderProps`
 * declares `children: ReactNode` as required — `createElement(Type,
 * props, children)` fails biome's `noChildrenProp` rule when children
 * is moved into props, and fails TS when children is omitted from
 * props. JSX sidesteps both.
 *
 * @module theme.test
 */

import { darkTheme, lightTheme, type Theme } from "@streamd/tokens";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ThemeProvider, useStreamdTheme } from "./theme";
import type { ThemeContextValue } from "./types";

/**
 * Consumer component that renders the current theme context values
 * into inspectable attributes on an `<rn-probe>` element. Tests read
 * these attributes via regex on the static markup.
 */
function Consumer(): ReactNode {
  const ctx: ThemeContextValue = useStreamdTheme();
  return <div data-theme-name={ctx.theme.name} data-class-prefix={ctx.classPrefix} />;
}

describe("useStreamdTheme — default context", () => {
  it("returns lightTheme + 'streamd' prefix when used outside any provider", () => {
    const html = renderToStaticMarkup(<Consumer />);
    expect(html).toContain(`data-theme-name="${lightTheme.name}"`);
    expect(html).toContain('data-class-prefix="streamd"');
  });
});

describe("ThemeProvider — context propagation", () => {
  it("provides the supplied theme and classPrefix to descendants", () => {
    const html = renderToStaticMarkup(
      <ThemeProvider theme={darkTheme} classPrefix="md" injectStylesheet={false}>
        <Consumer />
      </ThemeProvider>,
    );
    expect(html).toContain(`data-theme-name="${darkTheme.name}"`);
    expect(html).toContain('data-class-prefix="md"');
  });

  it("falls back to lightTheme when no theme prop is given", () => {
    const html = renderToStaticMarkup(
      <ThemeProvider injectStylesheet={false}>
        <Consumer />
      </ThemeProvider>,
    );
    expect(html).toContain(`data-theme-name="${lightTheme.name}"`);
  });

  it("falls back to 'streamd' classPrefix when no classPrefix prop is given", () => {
    const html = renderToStaticMarkup(
      <ThemeProvider theme={lightTheme} injectStylesheet={false}>
        <Consumer />
      </ThemeProvider>,
    );
    expect(html).toContain('data-class-prefix="streamd"');
  });

  it("renders children inside the provider", () => {
    const html = renderToStaticMarkup(
      <ThemeProvider injectStylesheet={false}>
        <div data-marker="child">hello</div>
      </ThemeProvider>,
    );
    expect(html).toContain('<div data-marker="child">hello</div>');
  });
});

describe("ThemeProvider — stylesheet injection", () => {
  it("injects a <style> tag with theme-derived CSS custom properties by default", () => {
    const html = renderToStaticMarkup(
      <ThemeProvider theme={lightTheme}>
        <span>x</span>
      </ThemeProvider>,
    );
    expect(html).toContain("<style");
    expect(html).toContain(`data-streamd-theme="${lightTheme.name}"`);
    expect(html).toContain("--streamd-color-background");
  });

  it("uses the supplied classPrefix in the injected stylesheet selector and variables", () => {
    const html = renderToStaticMarkup(
      <ThemeProvider theme={lightTheme} classPrefix="md">
        <span>x</span>
      </ThemeProvider>,
    );
    expect(html).toContain(".md-root");
    expect(html).toContain("--md-color-background");
    expect(html).not.toContain("--streamd-color-background");
  });

  it("suppresses the <style> tag when injectStylesheet=false", () => {
    const html = renderToStaticMarkup(
      <ThemeProvider injectStylesheet={false}>
        <span>x</span>
      </ThemeProvider>,
    );
    expect(html).not.toContain("<style");
    expect(html).not.toContain("data-streamd-theme");
  });

  it("stylesheet reflects the active theme — darkTheme produces different background than lightTheme", () => {
    const lightHtml = renderToStaticMarkup(
      <ThemeProvider theme={lightTheme} classPrefix="same">
        <span>x</span>
      </ThemeProvider>,
    );
    const darkHtml = renderToStaticMarkup(
      <ThemeProvider theme={darkTheme} classPrefix="same">
        <span>x</span>
      </ThemeProvider>,
    );
    expect(lightHtml).not.toBe(darkHtml);
    expect(lightHtml).toContain(`color-background: ${lightTheme.colors.background}`);
    expect(darkHtml).toContain(`color-background: ${darkTheme.colors.background}`);
  });

  it("accepts a custom theme object and threads its name onto data-streamd-theme", () => {
    const custom: Theme = { ...lightTheme, name: "my-custom-palette" };
    const html = renderToStaticMarkup(
      <ThemeProvider theme={custom}>
        <span>x</span>
      </ThemeProvider>,
    );
    expect(html).toContain('data-streamd-theme="my-custom-palette"');
  });
});
