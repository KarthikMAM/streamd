/**
 * Unit tests for streaming helper and theme stylesheet generator.
 *
 * @module streaming.test
 */

import { lightTheme } from "@streamd/tokens";
import { describe, expect, it } from "vitest";
import { renderThemeStylesheet, streamHtml } from "./streaming";

describe("streamHtml", () => {
  it("renders full source on a one-shot call and returns a usable state", () => {
    // One-shot render: correct HTML emitted, AND the returned state
    // can be threaded into a second streaming call to extend the
    // document without re-parsing from scratch.
    const r = streamHtml("# hi\n", null);
    expect(r.html).toBe("<h1>hi</h1>\n");
    // Observable proof the state is usable: a follow-up call extends
    // the same document with a paragraph and produces the expected
    // composite HTML.
    const r2 = streamHtml("# hi\nfollow\n", r.state);
    expect(r2.html).toBe("<h1>hi</h1>\n<p>follow</p>\n");
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
