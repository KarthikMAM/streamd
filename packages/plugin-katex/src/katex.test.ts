/**
 * Tests for `@streamd/plugin-katex`.
 *
 * KaTeX is mocked via `vi.mock` so the suite exercises the plugin's
 * token-walking + displayMode-resolution logic without loading
 * KaTeX's real fonts or grammar. The mock exposes a spy for
 * `renderToString` whose behaviour each test can customise by
 * modifying `renderToStringMock.mockImplementationOnce`.
 *
 * @module katex.test
 */

import {
  type MathBlockToken,
  type MathInlineToken,
  type ParagraphToken,
  parse,
  TOKEN_SCHEMA_VERSION,
  TokenType,
} from "@streamd/parser";
import { applyPlugins, StreamdPluginAbiError } from "@streamd/plugins";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const renderToString = vi.fn(
    (source: string, options: { displayMode?: boolean; throwOnError?: boolean } | undefined) => {
      const mode = options?.displayMode === true ? "block" : "inline";
      return `<span class="katex-${mode}">${source}</span>`;
    },
  );
  return { renderToString };
});

vi.mock("katex", () => ({
  default: { renderToString: mocks.renderToString },
  renderToString: mocks.renderToString,
}));

beforeEach(() => {
  mocks.renderToString.mockReset();
  mocks.renderToString.mockImplementation(
    (source: string, options: { displayMode?: boolean } | undefined) => {
      const mode = options?.displayMode === true ? "block" : "inline";
      return `<span class="katex-${mode}">${source}</span>`;
    },
  );
});

describe("katex factory — validation", () => {
  it("accepts an omitted options argument", async () => {
    const { katex } = await import("./index");
    const plugin = katex();
    expect(plugin.name).toBe("katex");
    expect(plugin.requires.tokenSchema).toBe(TOKEN_SCHEMA_VERSION);
  });

  it("accepts an empty options object", async () => {
    const { katex } = await import("./index");
    const plugin = katex({});
    expect(plugin.name).toBe("katex");
  });

  it("rejects non-object options with options-not-object kind", async () => {
    const { katex, StreamdPluginKatexArgumentError } = await import("./index");
    const factory = katex as unknown as (input: unknown) => unknown;
    expect(() => factory("nope")).toThrow(StreamdPluginKatexArgumentError);
    try {
      factory(42);
    } catch (err) {
      expect((err as { kind: string }).kind).toBe("options-not-object");
      expect((err as { source: string }).source).toBe("@streamd/plugin-katex");
    }
  });

  it("rejects non-boolean throwOnError with throw-on-error-not-boolean kind", async () => {
    const { katex } = await import("./index");
    const factory = katex as unknown as (input: unknown) => unknown;
    expect(() => factory({ throwOnError: "yes" })).toThrowError(
      expect.objectContaining({ kind: "throw-on-error-not-boolean" }),
    );
  });

  it("rejects invalid displayMode with display-mode-invalid kind", async () => {
    const { katex } = await import("./index");
    const factory = katex as unknown as (input: unknown) => unknown;
    expect(() => factory({ displayMode: "sideways" })).toThrowError(
      expect.objectContaining({ kind: "display-mode-invalid" }),
    );
  });

  it("rejects non-object macros with macros-not-object kind", async () => {
    const { katex } = await import("./index");
    const factory = katex as unknown as (input: unknown) => unknown;
    expect(() => factory({ macros: "oops" })).toThrowError(
      expect.objectContaining({ kind: "macros-not-object" }),
    );
  });

  it("rejects array macros because only plain objects are accepted", async () => {
    const { katex } = await import("./index");
    const factory = katex as unknown as (input: unknown) => unknown;
    expect(() => factory({ macros: [] })).toThrowError(
      expect.objectContaining({ kind: "macros-not-object" }),
    );
  });

  it("rejects non-string macro values with macro-value-not-string kind", async () => {
    const { katex } = await import("./index");
    const factory = katex as unknown as (input: unknown) => unknown;
    expect(() => factory({ macros: { "\\R": 42 } })).toThrowError(
      expect.objectContaining({ kind: "macro-value-not-string" }),
    );
  });
});

describe("katex transform — inline math", () => {
  it("renders inline math and sets meta.html", async () => {
    const { katex } = await import("./index");
    const plugin = katex();
    const tokens = parse("Euler: $e^{i\\pi}+1=0$ done.\n", null, { math: true }).tokens;
    const out = applyPlugins(tokens, [plugin]).tokens;
    const para = out[0] as ParagraphToken;
    const mathChild = para.children.find((c) => c.type === TokenType.MathInline) as
      | MathInlineToken
      | undefined;
    expect(mathChild).toBeDefined();
    expect(mathChild?.meta?.html).toContain('class="katex-inline"');
    expect(mathChild?.meta?.html).toContain("e^{i\\pi}+1=0");
  });

  it("passes displayMode=false for inline tokens in auto mode", async () => {
    const { katex } = await import("./index");
    const plugin = katex({ displayMode: "auto" });
    const tokens = parse("$x^2$\n", null, { math: true }).tokens;
    applyPlugins(tokens, [plugin]);
    const call = mocks.renderToString.mock.calls[0];
    expect(call?.[1]).toEqual(expect.objectContaining({ displayMode: false }));
  });
});

describe("katex transform — block math", () => {
  it("renders block math and sets meta.html", async () => {
    const { katex } = await import("./index");
    const plugin = katex();
    const tokens = parse("$$\n\\int_0^1 x\\, dx = \\tfrac{1}{2}\n$$\n", null, {
      math: true,
    }).tokens;
    const out = applyPlugins(tokens, [plugin]).tokens;
    const block = out[0] as MathBlockToken;
    expect(block.type).toBe(TokenType.MathBlock);
    expect(block.meta?.html).toContain('class="katex-block"');
  });

  it("passes displayMode=true for MathBlock tokens in auto mode", async () => {
    const { katex } = await import("./index");
    const plugin = katex();
    const tokens = parse("$$\nx+1\n$$\n", null, { math: true }).tokens;
    applyPlugins(tokens, [plugin]);
    const call = mocks.renderToString.mock.calls[0];
    expect(call?.[1]).toEqual(expect.objectContaining({ displayMode: true }));
  });

  it("forces display mode when displayMode=always-block", async () => {
    const { katex } = await import("./index");
    const plugin = katex({ displayMode: "always-block" });
    const tokens = parse("$x$\n", null, { math: true }).tokens;
    applyPlugins(tokens, [plugin]);
    const call = mocks.renderToString.mock.calls[0];
    expect(call?.[1]).toEqual(expect.objectContaining({ displayMode: true }));
  });

  it("forces inline mode when displayMode=always-inline", async () => {
    const { katex } = await import("./index");
    const plugin = katex({ displayMode: "always-inline" });
    const tokens = parse("$$\ny\n$$\n", null, { math: true }).tokens;
    applyPlugins(tokens, [plugin]);
    const call = mocks.renderToString.mock.calls[0];
    expect(call?.[1]).toEqual(expect.objectContaining({ displayMode: false }));
  });
});

describe("katex transform — throwOnError + macros", () => {
  it("passes throwOnError=false to KaTeX by default", async () => {
    const { katex } = await import("./index");
    const plugin = katex();
    const tokens = parse("$x$\n", null, { math: true }).tokens;
    applyPlugins(tokens, [plugin]);
    const call = mocks.renderToString.mock.calls[0];
    expect(call?.[1]).toEqual(expect.objectContaining({ throwOnError: false }));
  });

  it("propagates throwOnError=true to KaTeX", async () => {
    const { katex } = await import("./index");
    const plugin = katex({ throwOnError: true });
    const tokens = parse("$x$\n", null, { math: true }).tokens;
    applyPlugins(tokens, [plugin]);
    const call = mocks.renderToString.mock.calls[0];
    expect(call?.[1]).toEqual(expect.objectContaining({ throwOnError: true }));
  });

  it("passes macros through to KaTeX", async () => {
    const { katex } = await import("./index");
    const plugin = katex({ macros: { "\\R": "\\mathbb{R}" } });
    const tokens = parse("$x \\in \\R$\n", null, { math: true }).tokens;
    applyPlugins(tokens, [plugin]);
    const call = mocks.renderToString.mock.calls[0];
    expect(call?.[1]).toEqual(expect.objectContaining({ macros: { "\\R": "\\mathbb{R}" } }));
  });

  it("emits fallback HTML when KaTeX returns a fallback span (throwOnError off)", async () => {
    const { katex } = await import("./index");
    mocks.renderToString.mockImplementationOnce(
      (src: string) => `<span class="katex-error" title="ParseError">${src}</span>`,
    );
    const plugin = katex({ throwOnError: false });
    const tokens = parse("$\\invalid$\n", null, { math: true }).tokens;
    const out = applyPlugins(tokens, [plugin]).tokens;
    const para = out[0] as ParagraphToken;
    const mathChild = para.children.find((c) => c.type === TokenType.MathInline) as
      | MathInlineToken
      | undefined;
    expect(mathChild?.meta?.html).toContain('class="katex-error"');
    expect(mathChild?.meta?.html).toContain("\\invalid");
  });

  it("rewraps KaTeX throws as StreamdPluginAbiError when throwOnError is true", async () => {
    const { katex } = await import("./index");
    mocks.renderToString.mockImplementationOnce(() => {
      throw new Error("ParseError: unknown macro");
    });
    const plugin = katex({ throwOnError: true });
    const tokens = parse("$\\bad$\n", null, { math: true }).tokens;
    try {
      applyPlugins(tokens, [plugin]);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(StreamdPluginAbiError);
      expect((err as StreamdPluginAbiError).kind).toBe("transform-failed");
      expect((err as StreamdPluginAbiError).pluginName).toBe("katex");
      expect((err as StreamdPluginAbiError).cause).toBeInstanceOf(Error);
    }
  });
});

describe("katex transform — traversal + idempotence", () => {
  it("handles multiple math tokens in one pass", async () => {
    const { katex } = await import("./index");
    const plugin = katex();
    const tokens = parse("$a$ and $b$.\n\n$$c$$\n", null, { math: true }).tokens;
    applyPlugins(tokens, [plugin]);
    expect(mocks.renderToString).toHaveBeenCalledTimes(3);
  });

  it("skips tokens whose meta.html is already set", async () => {
    const { katex } = await import("./index");
    const plugin = katex();
    const tokens = parse("$x$\n", null, { math: true }).tokens;
    const para = tokens[0] as ParagraphToken;
    const rewritten: ParagraphToken = {
      ...para,
      children: para.children.map((c) =>
        c.type === TokenType.MathInline ? { ...c, meta: { html: "<pre>cached</pre>" } } : c,
      ),
    };
    const out = applyPlugins([rewritten], [plugin]).tokens;
    const result = out[0] as ParagraphToken;
    const math = result.children.find((c) => c.type === TokenType.MathInline) as MathInlineToken;
    expect(math.meta?.html).toBe("<pre>cached</pre>");
    expect(mocks.renderToString).not.toHaveBeenCalled();
  });
});
