/**
 * Public-API smoke test — exercise each published package as a downstream
 * consumer would import it, and verify the cross-package error hierarchy
 * works (single `instanceof StreamdArgumentError` catches all validation
 * failures).
 *
 * @module public-api.test
 */

import { parse } from "@streamd/parser";
import { StreamdArgumentError } from "@streamd/tokens";
import { describe, expect, it } from "vitest";

describe("public API — consumer surface", () => {
  it("parser: parse + re-export types", () => {
    const { tokens } = parse("# hi\n");
    expect(Array.isArray(tokens)).toBe(true);
    expect(tokens.length).toBeGreaterThan(0);
  });

  it("html: renderHtml and streamHtml importable", async () => {
    const { renderHtml, streamHtml } = await import("@streamd/html");
    expect(typeof renderHtml).toBe("function");
    expect(typeof streamHtml).toBe("function");

    const { tokens } = parse("**bold**");
    const html = renderHtml(tokens);
    expect(html).toContain("<strong>bold</strong>");
  });

  it("react: renderReact + theming importable", async () => {
    const react = await import("@streamd/react");
    expect(typeof react.renderReact).toBe("function");
    expect(typeof react.ThemeProvider).toBe("function");
    expect(typeof react.useStreamdTheme).toBe("function");
    expect(typeof react.StreamdMarkdown).toBe("function");
  });

  it("react-native: renderReactNative + theming importable", async () => {
    const rn = await import("@streamd/react-native");
    expect(typeof rn.renderReactNative).toBe("function");
    expect(typeof rn.ThemeProvider).toBe("function");
    expect(typeof rn.useStreamdTheme).toBe("function");
  });

  it("plugins: built-ins importable", async () => {
    const plugins = await import("@streamd/plugins");
    expect(typeof plugins.applyPlugins).toBe("function");
    expect(typeof plugins.sanitize).toBe("function");
    expect(typeof plugins.headingAnchors).toBe("function");
    expect(typeof plugins.highlightCode).toBe("function");
    expect(typeof plugins.linkAttributes).toBe("function");
  });

  it("tokens: themes and helpers importable", async () => {
    const tokens = await import("@streamd/tokens");
    expect(typeof tokens.lightTheme).toBe("object");
    expect(typeof tokens.darkTheme).toBe("object");
    expect(typeof tokens.mergeTheme).toBe("function");
    expect(typeof tokens.themeToCss).toBe("function");
  });
});

describe("public API — unified error hierarchy", () => {
  it("html validation error caught by StreamdArgumentError instanceof", async () => {
    const { renderHtml } = await import("@streamd/html");
    let caught: unknown;
    try {
      renderHtml(null as unknown as Array<never>);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(StreamdArgumentError);
    const e = caught as StreamdArgumentError;
    expect(e.source).toBe("@streamd/html");
    expect(e.kind).toBe("tokens-not-array");
  });

  it("react validation error caught by StreamdArgumentError instanceof", async () => {
    const { renderReact } = await import("@streamd/react");
    let caught: unknown;
    try {
      renderReact(undefined as unknown as Array<never>);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(StreamdArgumentError);
    const e = caught as StreamdArgumentError;
    expect(e.source).toBe("@streamd/react");
    expect(e.kind).toBe("tokens-not-array");
  });

  it("react-native validation error caught by StreamdArgumentError instanceof", async () => {
    const { renderReactNative } = await import("@streamd/react-native");
    let caught: unknown;
    try {
      renderReactNative(0 as unknown as Array<never>);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(StreamdArgumentError);
    const e = caught as StreamdArgumentError;
    expect(e.source).toBe("@streamd/react-native");
    expect(e.kind).toBe("tokens-not-array");
  });
});
