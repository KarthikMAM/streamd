/**
 * Unit tests for `compose.ts` — the CLI option → pipeline-options
 * transformers. Each function is pure, so the tests construct an
 * in-memory `CliOptions` record and assert on the exact output.
 *
 * Covers the four exported transformers:
 *  - `buildParseOptions` — CLI flags → parser `ParseOptions`.
 *  - `buildPlugins` — CLI flags → ordered plugin array.
 *  - `buildStreamOptions` — combined parse + render options for `streamHtml`.
 *  - `buildThemeStyleBlock` — `--theme` resolution to a `<style>` block.
 *
 * @module compose.test
 */

import { describe, expect, it } from "vitest";
import {
  buildParseOptions,
  buildPlugins,
  buildStreamOptions,
  buildThemeStyleBlock,
} from "./compose";
import type { CliOptions } from "./types";

/**
 * Build a `CliOptions` record with every flag defaulted to its
 * CLI-default value. Individual tests override only the flags they
 * care about, keeping each test body focused on the one observable
 * it's asserting.
 */
function makeOptions(overrides: Partial<CliOptions> = {}): CliOptions {
  return {
    gfm: false,
    math: false,
    classPrefix: "",
    theme: "none",
    anchors: false,
    linkAttrs: false,
    sanitize: true,
    allowDangerousMetaHtml: false,
    stream: "auto",
    wrapRoot: false,
    xhtml: true,
    help: false,
    version: false,
    ...overrides,
  };
}

describe("buildParseOptions", () => {
  it("maps gfm=false + math=false to ParseOptions { gfm: false, math: false }", () => {
    expect(buildParseOptions(makeOptions())).toEqual({ gfm: false, math: false });
  });

  it("carries gfm=true through", () => {
    expect(buildParseOptions(makeOptions({ gfm: true })).gfm).toBe(true);
  });

  it("carries math=true through", () => {
    expect(buildParseOptions(makeOptions({ math: true })).math).toBe(true);
  });

  it("carries both gfm and math through independently", () => {
    const opts = buildParseOptions(makeOptions({ gfm: true, math: true }));
    expect(opts).toEqual({ gfm: true, math: true });
  });
});

describe("buildPlugins", () => {
  it("returns [sanitize] by default (sanitize is on, no other plugin flags)", () => {
    const plugins = buildPlugins(makeOptions());
    expect(plugins).toHaveLength(1);
    expect(plugins[0]?.name).toBe("sanitize");
  });

  it("returns empty array when sanitize is off and no other flags", () => {
    const plugins = buildPlugins(makeOptions({ sanitize: false }));
    expect(plugins).toEqual([]);
  });

  it("prepends headingAnchors when anchors=true", () => {
    const plugins = buildPlugins(makeOptions({ anchors: true }));
    expect(plugins.map((p) => p.name)).toEqual(["headingAnchors", "sanitize"]);
  });

  it("prepends linkAttributes when linkAttrs=true", () => {
    const plugins = buildPlugins(makeOptions({ linkAttrs: true }));
    expect(plugins.map((p) => p.name)).toEqual(["linkAttributes", "sanitize"]);
  });

  it("preserves ordering: headingAnchors → linkAttributes → sanitize", () => {
    // Order matters: sanitize must be last per the plugin ABI enforced
    // by applyPlugins. Verify compose produces that order.
    const plugins = buildPlugins(makeOptions({ anchors: true, linkAttrs: true, sanitize: true }));
    expect(plugins.map((p) => p.name)).toEqual(["headingAnchors", "linkAttributes", "sanitize"]);
  });

  it("omits sanitize entirely when --no-sanitize is passed", () => {
    const plugins = buildPlugins(makeOptions({ anchors: true, sanitize: false }));
    expect(plugins.map((p) => p.name)).toEqual(["headingAnchors"]);
  });
});

describe("buildStreamOptions", () => {
  it("forwards parse, plugins, xhtml, wrapRoot, allowDangerousMetaHtml", () => {
    const out = buildStreamOptions(
      makeOptions({ gfm: true, xhtml: false, wrapRoot: true, allowDangerousMetaHtml: true }),
    );
    expect(out.parse).toEqual({ gfm: true, math: false });
    expect(out.xhtml).toBe(false);
    expect(out.wrapRoot).toBe(true);
    expect(out.allowDangerousMetaHtml).toBe(true);
    // Default CLI has sanitize=true → plugins contains exactly [sanitize].
    expect(out.plugins?.map((p) => p.name)).toEqual(["sanitize"]);
  });

  it("omits classPrefix when classPrefix is the empty default", () => {
    const out = buildStreamOptions(makeOptions());
    expect("classPrefix" in out).toBe(false);
  });

  it("includes classPrefix when it is non-empty", () => {
    const out = buildStreamOptions(makeOptions({ classPrefix: "md" }));
    expect(out.classPrefix).toBe("md");
  });
});

describe("buildThemeStyleBlock", () => {
  it("returns null when theme='none'", () => {
    expect(buildThemeStyleBlock(makeOptions({ theme: "none" }))).toBeNull();
  });

  it("returns a <style> block wrapping the light theme stylesheet when theme='light'", () => {
    const block = buildThemeStyleBlock(makeOptions({ theme: "light" }));
    expect(block).not.toBeNull();
    expect(block?.startsWith("<style>")).toBe(true);
    expect(block?.trimEnd().endsWith("</style>")).toBe(true);
    // Light theme background — the canonical contract marker for the
    // light palette. Confirms we wired the light theme (not dark).
    expect(block).toContain("color-background: #ffffff");
  });

  it("returns a <style> block wrapping the dark theme stylesheet when theme='dark'", () => {
    const block = buildThemeStyleBlock(makeOptions({ theme: "dark" }));
    expect(block).not.toBeNull();
    expect(block?.startsWith("<style>")).toBe(true);
    // Dark-theme background — contract marker distinguishing it from light.
    expect(block).not.toContain("color-background: #ffffff");
  });

  it("uses the DEFAULT_THEME_PREFIX 'streamd' when classPrefix is empty", () => {
    const block = buildThemeStyleBlock(makeOptions({ theme: "light" }));
    expect(block).toContain("--streamd-color-background");
  });

  it("uses the user-supplied classPrefix when non-empty", () => {
    const block = buildThemeStyleBlock(makeOptions({ theme: "light", classPrefix: "md" }));
    expect(block).toContain("--md-color-background");
    expect(block).not.toContain("--streamd-color-background");
  });
});
