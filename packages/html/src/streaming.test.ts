/**
 * Unit tests for streaming helper and theme stylesheet generator.
 *
 * @module streaming.test
 */

import { lightTheme } from "@streamd/tokens";
import { describe, expect, it } from "vitest";
import { renderThemeStylesheet, streamHtml } from "./streaming";

describe("streamHtml", () => {
  it("renders full source on a one-shot call", () => {
    const r = streamHtml("# hi\n", null);
    expect(r.html).toBe("<h1>hi</h1>\n");
    expect(r.state).toBeTruthy();
  });

  it("produces the same final HTML when called incrementally", () => {
    const full = streamHtml("hello **bold** world\n", null).html;
    const stages = ["hello ", "**bold**", " world\n"];
    let state = streamHtml(stages[0], null).state;
    let accumulated = stages[0];
    for (let i = 1; i < stages.length; i++) {
      accumulated += stages[i];
      state = streamHtml(accumulated, state).state;
    }
    const final = streamHtml(accumulated, state).html;
    expect(final).toBe(full);
  });

  it("honours parse.gfm=true", () => {
    const r = streamHtml("~~gone~~\n", null, { parse: { gfm: true } });
    expect(r.html).toBe("<p><del>gone</del></p>\n");
  });
});

describe("renderThemeStylesheet", () => {
  it("emits custom properties and rule block for a theme", () => {
    const css = renderThemeStylesheet(lightTheme);
    expect(css).toContain(".streamd-root {");
    expect(css).toContain("--streamd-color-text: #1f2328");
    expect(css).toContain(".streamd-root h1");
    expect(css).toContain("--streamd-heading-1");
  });

  it("respects a custom classPrefix", () => {
    const css = renderThemeStylesheet(lightTheme, { classPrefix: "md" });
    expect(css).toContain(".md-root {");
    expect(css).not.toContain(".streamd-root");
  });
});
