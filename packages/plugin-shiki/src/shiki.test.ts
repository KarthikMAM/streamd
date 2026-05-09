/**
 * Tests for `@streamd/plugin-shiki`.
 *
 * Shiki is mocked via `vi.mock` so the test suite exercises the
 * plugin's token-walking + language-resolution logic without pulling
 * in the real grammar / theme loaders. The mock returns structured
 * token arrays matching Shiki's `codeToTokens` shape.
 *
 * @module shiki.test
 */

import {
  type BlockquoteToken,
  type CodeBlockToken,
  type HighlightData,
  parse,
  TOKEN_SCHEMA_VERSION,
  TokenType,
} from "@streamd/parser";
import { applyPlugins } from "@streamd/plugins";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const codeToTokens = vi.fn((_code: string, _opts: { lang: string; theme: string }) => ({
    tokens: [[{ content: _code.trimEnd(), color: "#000000", fontStyle: 0 }]],
    fg: "#000000",
    bg: "#ffffff",
  }));
  const getLoadedLanguages = vi.fn(
    (): Array<string> => ["typescript", "javascript", "plaintext", "bash"],
  );
  const createHighlighter = vi.fn(
    async (_opts: { themes: Array<unknown>; langs: Array<string> }) => ({
      codeToTokens,
      getLoadedLanguages,
    }),
  );
  return { codeToTokens, getLoadedLanguages, createHighlighter };
});

vi.mock("shiki", () => ({
  createHighlighter: mocks.createHighlighter,
}));

/** Counter for unique theme names per test. */
let themeCounter = 0;

/**
 * Generate a cache-key-unique theme pair for one test.
 *
 * @param suffix Optional disambiguator appended to the theme names.
 * @returns A fresh `{ light, dark }` pair.
 */
function uniqueTheme(suffix = ""): { light: string; dark: string } {
  themeCounter += 1;
  return {
    light: `test-light-${themeCounter}${suffix}`,
    dark: `test-dark-${themeCounter}${suffix}`,
  };
}

/**
 * Extract highlight data from a code block token.
 *
 * @param token Code block token to extract from.
 * @returns The HighlightData or undefined.
 */
function getHighlight(token: CodeBlockToken): HighlightData | undefined {
  return token.meta?.highlight;
}

beforeEach(() => {
  mocks.codeToTokens.mockClear();
  mocks.getLoadedLanguages.mockClear();
  mocks.createHighlighter.mockClear();
});

describe("shiki factory — validation", () => {
  it("rejects missing options with missing-options kind", async () => {
    const { shiki, StreamdPluginShikiArgumentError } = await import("./index");
    const factory = shiki as unknown as (input: unknown) => Promise<unknown>;
    await expect(factory(undefined)).rejects.toBeInstanceOf(StreamdPluginShikiArgumentError);
  });

  it("rejects non-object options with options-not-object kind", async () => {
    const { shiki, StreamdPluginShikiArgumentError } = await import("./index");
    const factory = shiki as unknown as (input: unknown) => Promise<unknown>;
    await expect(factory("not-an-object")).rejects.toMatchObject({
      name: "StreamdPluginShikiArgumentError",
      kind: "options-not-object",
    });
    await expect(factory(null)).rejects.toBeInstanceOf(StreamdPluginShikiArgumentError);
  });

  it("rejects missing themes with themes-missing kind", async () => {
    const { shiki } = await import("./index");
    const factory = shiki as unknown as (input: unknown) => Promise<unknown>;
    await expect(factory({})).rejects.toMatchObject({
      kind: "themes-missing",
      source: "@streamd/plugin-shiki",
    });
  });

  it("rejects non-string light theme with theme-not-string kind", async () => {
    const { shiki } = await import("./index");
    const factory = shiki as unknown as (input: unknown) => Promise<unknown>;
    await expect(factory({ themes: { light: 42, dark: "github-dark" } })).rejects.toMatchObject({
      kind: "theme-not-string",
    });
  });

  it("rejects empty-string dark theme with theme-not-string kind", async () => {
    const { shiki } = await import("./index");
    const factory = shiki as unknown as (input: unknown) => Promise<unknown>;
    await expect(factory({ themes: { light: "github-light", dark: "" } })).rejects.toMatchObject({
      kind: "theme-not-string",
    });
  });

  it("rejects non-array langs with langs-not-array kind", async () => {
    const { shiki } = await import("./index");
    const factory = shiki as unknown as (input: unknown) => Promise<unknown>;
    await expect(factory({ themes: uniqueTheme(), langs: "typescript" })).rejects.toMatchObject({
      kind: "langs-not-array",
    });
  });

  it("rejects non-function loadTheme with load-theme-not-function kind", async () => {
    const { shiki } = await import("./index");
    const factory = shiki as unknown as (input: unknown) => Promise<unknown>;
    await expect(factory({ themes: uniqueTheme(), loadTheme: "oops" })).rejects.toMatchObject({
      kind: "load-theme-not-function",
    });
  });

  it("rejects invalid onUnknownLang with on-unknown-lang-invalid kind", async () => {
    const { shiki } = await import("./index");
    const factory = shiki as unknown as (input: unknown) => Promise<unknown>;
    await expect(
      factory({ themes: uniqueTheme(), onUnknownLang: "nonsense" }),
    ).rejects.toMatchObject({ kind: "on-unknown-lang-invalid" });
  });
});

describe("shiki factory — highlighter wiring", () => {
  it("returns a Plugin with the current token schema declared", async () => {
    const { shiki } = await import("./index");
    const plugin = await shiki({ themes: uniqueTheme() });
    expect(plugin.name).toBe("shiki");
    expect(plugin.requires.tokenSchema).toBe(TOKEN_SCHEMA_VERSION);
  });

  it("passes both themes through to the shiki highlighter", async () => {
    const { shiki } = await import("./index");
    const themes = uniqueTheme("-pair");
    await shiki({ themes });
    expect(mocks.createHighlighter).toHaveBeenCalledTimes(1);
    const arg = mocks.createHighlighter.mock.calls[0]?.[0] as unknown as {
      themes: Array<string>;
      langs: Array<string>;
    };
    expect(arg.themes).toEqual([themes.light, themes.dark]);
  });

  it("uses the default language set when langs is omitted", async () => {
    const { shiki } = await import("./index");
    await shiki({ themes: uniqueTheme("-default-langs") });
    const arg = mocks.createHighlighter.mock.calls[0]?.[0] as unknown as { langs: Array<string> };
    expect(arg.langs).toContain("typescript");
    expect(arg.langs).toContain("javascript");
    expect(arg.langs).toContain("plaintext");
  });

  it("restricts langs when caller pins a list", async () => {
    const { shiki } = await import("./index");
    await shiki({ themes: uniqueTheme("-langs"), langs: ["bash", "json"] });
    const arg = mocks.createHighlighter.mock.calls[0]?.[0] as unknown as { langs: Array<string> };
    expect(arg.langs).toEqual(["bash", "json"]);
  });

  it("routes both theme names through loadTheme when provided", async () => {
    const { shiki } = await import("./index");
    const themes = uniqueTheme("-custom");
    const loadTheme = vi.fn(async (name: string) => ({ name, type: "dark" as const }));
    await shiki({ themes, loadTheme });
    expect(loadTheme).toHaveBeenCalledTimes(2);
    expect(loadTheme).toHaveBeenCalledWith(themes.light);
    expect(loadTheme).toHaveBeenCalledWith(themes.dark);
    const arg = mocks.createHighlighter.mock.calls[0]?.[0] as unknown as {
      themes: Array<{ name: string }>;
    };
    expect(arg.themes[0]?.name).toBe(themes.light);
    expect(arg.themes[1]?.name).toBe(themes.dark);
  });
});

describe("shiki transform — structured highlight annotation", () => {
  it("sets meta.highlight on known-language code blocks", async () => {
    const { shiki } = await import("./index");
    const themes = uniqueTheme("-known");
    const plugin = await shiki({ themes });
    const tokens = parse("```typescript\nlet x = 1;\n```\n").tokens;
    const out = applyPlugins(tokens, [plugin]).tokens;
    const block = out[0] as CodeBlockToken;
    const highlight = getHighlight(block);

    expect(highlight).not.toBeUndefined();
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    expect(highlight!.lang).toBe("typescript");
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    expect(highlight!.theme).toBe(themes.light);
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    expect(highlight!.lines.length).toBeGreaterThanOrEqual(1);
    expect(mocks.codeToTokens).toHaveBeenCalledTimes(1);
  });

  it("produces segments whose combined text equals the source code", async () => {
    const { shiki } = await import("./index");
    const plugin = await shiki({ themes: uniqueTheme("-text-eq") });
    mocks.codeToTokens.mockReturnValueOnce({
      tokens: [
        [
          { content: "let", color: "#0000ff", fontStyle: 0 },
          { content: " x = 1;", color: "#000000", fontStyle: 0 },
        ],
      ],
      fg: "#000",
      bg: "#fff",
    });
    const tokens = parse("```typescript\nlet x = 1;\n```\n").tokens;
    const out = applyPlugins(tokens, [plugin]).tokens;
    const highlight = getHighlight(out[0] as CodeBlockToken);

    expect(highlight).not.toBeUndefined();
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    const combined = highlight!.lines[0]!.map((s) => s.text).join("");
    expect(combined).toBe("let x = 1;");
  });

  it("maps multi-line code to multiple highlight lines", async () => {
    const { shiki } = await import("./index");
    const plugin = await shiki({ themes: uniqueTheme("-multiline") });
    mocks.codeToTokens.mockReturnValueOnce({
      tokens: [
        [{ content: "const a = 1;", color: "#000", fontStyle: 0 }],
        [{ content: "const b = 2;", color: "#000", fontStyle: 0 }],
        [{ content: "const c = 3;", color: "#000", fontStyle: 0 }],
      ],
      fg: "#000",
      bg: "#fff",
    });
    const tokens = parse("```typescript\nconst a = 1;\nconst b = 2;\nconst c = 3;\n```\n").tokens;
    const out = applyPlugins(tokens, [plugin]).tokens;
    const highlight = getHighlight(out[0] as CodeBlockToken);

    expect(highlight).not.toBeUndefined();
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    expect(highlight!.lines.length).toBe(3);
  });

  it("maps fontStyle bitmask to bold, italic, underline fields", async () => {
    const { shiki } = await import("./index");
    const plugin = await shiki({ themes: uniqueTheme("-fontstyle") });
    mocks.codeToTokens.mockReturnValueOnce({
      tokens: [
        [
          { content: "bold", color: "#f00", fontStyle: 2 },
          { content: "italic", color: "#0f0", fontStyle: 1 },
          { content: "underline", color: "#00f", fontStyle: 4 },
          { content: "all", color: "#fff", fontStyle: 7 },
        ],
      ],
      fg: "#000",
      bg: "#fff",
    });
    const tokens = parse("```typescript\nbold italic underline all\n```\n").tokens;
    const out = applyPlugins(tokens, [plugin]).tokens;
    const highlight = getHighlight(out[0] as CodeBlockToken);

    expect(highlight).not.toBeUndefined();
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    const segments = highlight!.lines[0]!;
    expect(segments[0]).toEqual({ text: "bold", color: "#f00", bold: true });
    expect(segments[1]).toEqual({ text: "italic", color: "#0f0", italic: true });
    expect(segments[2]).toEqual({ text: "underline", color: "#00f", underline: true });
    expect(segments[3]).toEqual({
      text: "all",
      color: "#fff",
      bold: true,
      italic: true,
      underline: true,
    });
  });

  it("passes the light theme to codeToTokens", async () => {
    const { shiki } = await import("./index");
    const themes = uniqueTheme("-theme-pass");
    const plugin = await shiki({ themes });
    const tokens = parse("```typescript\nx;\n```\n").tokens;
    applyPlugins(tokens, [plugin]);
    const call = mocks.codeToTokens.mock.calls[0]?.[1] as unknown as {
      theme: string;
      lang: string;
    };
    expect(call.theme).toBe(themes.light);
    expect(call.lang).toBe("typescript");
  });

  it("sets highlight.theme to the light theme key", async () => {
    const { shiki } = await import("./index");
    const themes = uniqueTheme("-theme-key");
    const plugin = await shiki({ themes });
    const tokens = parse("```typescript\nx;\n```\n").tokens;
    const out = applyPlugins(tokens, [plugin]).tokens;
    const highlight = getHighlight(out[0] as CodeBlockToken);

    expect(highlight).not.toBeUndefined();
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    expect(highlight!.theme).toBe(themes.light);
  });

  it("defaults unknown languages to plaintext", async () => {
    const { shiki } = await import("./index");
    const plugin = await shiki({ themes: uniqueTheme("-unknown-default") });
    const tokens = parse("```brainfuck\n+++\n```\n").tokens;
    const out = applyPlugins(tokens, [plugin]).tokens;
    const highlight = getHighlight(out[0] as CodeBlockToken);

    expect(highlight).not.toBeUndefined();
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    expect(highlight!.lang).toBe("plaintext");
    expect(mocks.codeToTokens).toHaveBeenCalledWith(
      "+++\n",
      expect.objectContaining({ lang: "plaintext" }),
    );
  });

  it("skips unknown languages when onUnknownLang is 'ignore'", async () => {
    const { shiki } = await import("./index");
    const plugin = await shiki({
      themes: uniqueTheme("-unknown-ignore"),
      onUnknownLang: "ignore",
    });
    const tokens = parse("```brainfuck\n+++\n```\n").tokens;
    const out = applyPlugins(tokens, [plugin]).tokens;
    expect(getHighlight(out[0] as CodeBlockToken)).toBeUndefined();
    expect(mocks.codeToTokens).not.toHaveBeenCalled();
  });

  it("throws StreamdPluginShikiArgumentError when onUnknownLang is 'error'", async () => {
    const { shiki, StreamdPluginShikiArgumentError } = await import("./index");
    const plugin = await shiki({
      themes: uniqueTheme("-unknown-error"),
      onUnknownLang: "error",
    });
    const tokens = parse("```brainfuck\n+++\n```\n").tokens;
    expect(() => applyPlugins(tokens, [plugin])).toThrow();

    try {
      applyPlugins(tokens, [plugin]);
    } catch (err) {
      const cause = (err as { cause?: unknown }).cause;
      expect(cause).toBeInstanceOf(StreamdPluginShikiArgumentError);
      expect((cause as { kind: string }).kind).toBe("unknown-language");
    }
  });

  it("defaults fenced blocks without a language to plaintext", async () => {
    const { shiki } = await import("./index");
    const plugin = await shiki({ themes: uniqueTheme("-no-lang") });
    const tokens = parse("```\nplain content\n```\n").tokens;
    const out = applyPlugins(tokens, [plugin]).tokens;
    const highlight = getHighlight(out[0] as CodeBlockToken);

    expect(highlight).not.toBeUndefined();
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    expect(highlight!.lang).toBe("plaintext");
  });

  it("leaves tokens unchanged when meta.highlight is already set", async () => {
    const { shiki } = await import("./index");
    const plugin = await shiki({ themes: uniqueTheme("-preset") });
    const tokens = parse("```typescript\nx;\n```\n").tokens;
    const existing: HighlightData = { lines: [], lang: "ts", theme: "custom" };
    const preset = tokens.map((t) => ({
      ...t,
      meta: { highlight: existing },
    }));
    const out = applyPlugins(preset, [plugin]).tokens;
    expect(getHighlight(out[0] as CodeBlockToken)).toBe(existing);
    expect(mocks.codeToTokens).not.toHaveBeenCalled();
  });

  it("handles nested code blocks inside a blockquote", async () => {
    const { shiki } = await import("./index");
    const plugin = await shiki({ themes: uniqueTheme("-nested") });
    const tokens = parse("> ```typescript\n> let x = 1;\n> ```\n").tokens;
    const out = applyPlugins(tokens, [plugin]).tokens;
    const bq = out[0] as BlockquoteToken;
    expect(bq.type).toBe(TokenType.Blockquote);
    const inner = bq.children[0] as CodeBlockToken;
    expect(inner.type).toBe(TokenType.CodeBlock);
    const highlight = getHighlight(inner);

    expect(highlight).not.toBeUndefined();
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    expect(highlight!.lang).toBe("typescript");
  });

  it("handles multiple code blocks in one pass", async () => {
    const { shiki } = await import("./index");
    const plugin = await shiki({ themes: uniqueTheme("-multi") });
    const tokens = parse("```typescript\na;\n```\n\n```javascript\nb;\n```\n").tokens;
    const out = applyPlugins(tokens, [plugin]).tokens;
    const codeBlocks = out.filter((t) => t.type === TokenType.CodeBlock) as Array<CodeBlockToken>;

    expect(codeBlocks.length).toBe(2);
    const h1 = getHighlight(codeBlocks[0] as CodeBlockToken);
    const h2 = getHighlight(codeBlocks[1] as CodeBlockToken);

    expect(h1).not.toBeUndefined();
    expect(h2).not.toBeUndefined();
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    expect(h1!.lang).toBe("typescript");
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    expect(h2!.lang).toBe("javascript");
    expect(mocks.codeToTokens).toHaveBeenCalledTimes(2);
  });
});

describe("shiki factory — highlighter cache", () => {
  it("reuses the same highlighter for repeat calls with matching config", async () => {
    const { shiki } = await import("./index");
    const themes = uniqueTheme("-cache-hit");
    await shiki({ themes });
    await shiki({ themes });
    expect(mocks.createHighlighter).toHaveBeenCalledTimes(1);
  });

  it("builds a fresh highlighter on every call when cache is false", async () => {
    const { shiki } = await import("./index");
    const themes = uniqueTheme("-cache-off");
    await shiki({ themes, cache: false });
    await shiki({ themes, cache: false });
    expect(mocks.createHighlighter).toHaveBeenCalledTimes(2);
  });

  it("builds a fresh highlighter when themes differ even with cache enabled", async () => {
    const { shiki } = await import("./index");
    await shiki({ themes: uniqueTheme("-vary-a") });
    await shiki({ themes: uniqueTheme("-vary-b") });
    expect(mocks.createHighlighter).toHaveBeenCalledTimes(2);
  });
});
