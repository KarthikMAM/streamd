/**
 * Tests for `@streamd/plugin-shiki`.
 *
 * Shiki is mocked via `vi.mock` so the test suite exercises the
 * plugin's token-walking + language-resolution logic without pulling
 * in the real grammar / theme loaders. The mock keeps a running spy
 * for `createHighlighter` and `codeToHtml` so cache-hit and
 * highlight-content assertions can inspect call counts and arguments
 * directly.
 *
 * @module shiki.test
 */

import {
  type BlockquoteToken,
  type CodeBlockToken,
  parse,
  TOKEN_SCHEMA_VERSION,
  TokenType,
} from "@streamd/parser";
import { applyPlugins } from "@streamd/plugins";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const codeToHtml = vi.fn(
    (code: string, opts: { lang: string }) =>
      `<pre class="shiki-mock" data-lang="${opts.lang}"><code>${code}</code></pre>`,
  );
  const getLoadedLanguages = vi.fn(
    (): Array<string> => ["typescript", "javascript", "plaintext", "bash"],
  );
  const createHighlighter = vi.fn(
    async (_opts: { themes: Array<unknown>; langs: Array<string> }) => ({
      codeToHtml,
      getLoadedLanguages,
    }),
  );
  return { codeToHtml, getLoadedLanguages, createHighlighter };
});

vi.mock("shiki", () => ({
  createHighlighter: mocks.createHighlighter,
}));

/**
 * Counter used by `uniqueTheme` to hand out fresh theme names per
 * test. Tests that share theme names across runs would collide on
 * the module-level highlighter cache.
 */
let themeCounter = 0;

/**
 * Generate a cache-key-unique theme pair for one test. Using a
 * fresh key in each test keeps the module-level `HIGHLIGHTER_CACHE`
 * from leaking state between cases without needing a private reset
 * hook.
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

beforeEach(() => {
  mocks.codeToHtml.mockClear();
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

describe("shiki transform — code block highlighting", () => {
  it("sets meta.html on known-language code blocks", async () => {
    const { shiki } = await import("./index");
    const plugin = await shiki({ themes: uniqueTheme("-known") });
    const tokens = parse("```typescript\nlet x = 1;\n```\n").tokens;
    const out = applyPlugins(tokens, [plugin]).tokens;
    const block = out[0] as CodeBlockToken;
    expect(block.meta?.html).toContain('data-lang="typescript"');
    expect(block.meta?.html).toContain("let x = 1;");
    expect(mocks.codeToHtml).toHaveBeenCalledTimes(1);
  });

  it("passes both themes to codeToHtml for dual-theme output", async () => {
    const { shiki } = await import("./index");
    const themes = uniqueTheme("-dual");
    const plugin = await shiki({ themes });
    const tokens = parse("```typescript\nx;\n```\n").tokens;
    applyPlugins(tokens, [plugin]);
    const call = mocks.codeToHtml.mock.calls[0]?.[1] as unknown as {
      themes: { light: string; dark: string };
      lang: string;
    };
    expect(call.themes).toEqual(themes);
    expect(call.lang).toBe("typescript");
  });

  it("defaults unknown languages to plaintext", async () => {
    const { shiki } = await import("./index");
    const plugin = await shiki({ themes: uniqueTheme("-unknown-default") });
    const tokens = parse("```brainfuck\n+++\n```\n").tokens;
    const out = applyPlugins(tokens, [plugin]).tokens;
    const block = out[0] as CodeBlockToken;
    expect(block.meta?.html).toContain('data-lang="plaintext"');
    expect(mocks.codeToHtml).toHaveBeenCalledWith(
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
    expect((out[0] as CodeBlockToken).meta?.html).toBeUndefined();
    expect(mocks.codeToHtml).not.toHaveBeenCalled();
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
      // applyPlugins rewraps transform errors — the original is on `cause`.
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
    expect((out[0] as CodeBlockToken).meta?.html).toContain('data-lang="plaintext"');
  });

  it("leaves tokens unchanged when meta.html is already set", async () => {
    const { shiki } = await import("./index");
    const plugin = await shiki({ themes: uniqueTheme("-preset") });
    const tokens = parse("```typescript\nx;\n```\n").tokens;
    const preset = tokens.map((t) => ({
      ...t,
      meta: { html: "<pre>already done</pre>" },
    }));
    const out = applyPlugins(preset, [plugin]).tokens;
    expect(out[0]?.meta?.html).toBe("<pre>already done</pre>");
    expect(mocks.codeToHtml).not.toHaveBeenCalled();
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
    expect(inner.meta?.html).toContain('data-lang="typescript"');
  });

  it("handles multiple code blocks in one pass", async () => {
    const { shiki } = await import("./index");
    const plugin = await shiki({ themes: uniqueTheme("-multi") });
    const tokens = parse("```typescript\na;\n```\n\n```javascript\nb;\n```\n").tokens;
    const out = applyPlugins(tokens, [plugin]).tokens;
    expect((out[0] as CodeBlockToken).meta?.html).toContain('data-lang="typescript"');
    expect((out[1] as CodeBlockToken).meta?.html).toContain('data-lang="javascript"');
    expect(mocks.codeToHtml).toHaveBeenCalledTimes(2);
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
