/**
 * Unit tests for walker and applyPlugins pipeline.
 *
 * @module walk.test
 */
import {
  type HeadingToken,
  type LinkToken,
  parse,
  TOKEN_SCHEMA_VERSION,
  TokenType,
} from "@streamd/parser";
import { describe, expect, it } from "vitest";
import { StreamdPluginAbiError } from "./errors";
import type { Plugin } from "./types";
import { applyPlugins, composePlugins, walk } from "./walk";

/** Build a plugin with the current ABI declaration pre-filled. */
function makePlugin(name: string, transform: Plugin["transform"]): Plugin {
  return {
    name,
    requires: { tokenSchema: TOKEN_SCHEMA_VERSION },
    transform,
  };
}

/**
 * Throw an arbitrary runtime value. Typed as `never` so Biome's
 * `useThrowOnlyError` rule (which inspects the static type of the
 * `throw` operand) accepts the statement while the underlying value
 * remains `unknown` — exactly the shape we need to exercise the
 * transform-failed wrapping path for non-Error cases.
 */
function throwValue(value: unknown): never {
  throw value as Error;
}

describe("walk", () => {
  it("returns the same array when visitor makes no changes", () => {
    const tokens = parse("# a\n\nb\n").tokens;
    const out = walk(tokens, {});
    expect(out).toBe(tokens);
  });

  it("replaces a block token when visitor returns a new one", () => {
    const tokens = parse("# a\n").tokens;
    const out = walk(tokens, {
      block(t) {
        if (t.type !== TokenType.Heading) return undefined;
        return { ...(t as HeadingToken), level: 3 as const };
      },
    });
    expect((out[0] as HeadingToken).level).toBe(3);
  });

  it("drops a block when visitor returns null", () => {
    const tokens = parse("a\n\nb\n").tokens;
    const out = walk(tokens, {
      block(t) {
        return t.type === TokenType.Paragraph ? null : undefined;
      },
    });
    expect(out.length).toBe(0);
  });

  it("descends into blockquote children", () => {
    const tokens = parse("> hello **world**\n").tokens;
    let sawStrong = false;
    walk(tokens, {
      inline(t) {
        if (t.type === TokenType.Strong) sawStrong = true;
        return undefined;
      },
    });
    expect(sawStrong).toBe(true);
  });

  it("descends into list items", () => {
    const tokens = parse("- a\n- b\n").tokens;
    let count = 0;
    walk(tokens, {
      inline(t) {
        if (t.type === TokenType.Text) count++;
        return undefined;
      },
    });
    expect(count).toBe(2);
  });

  it("descends into table cells", () => {
    const tokens = parse("| a | b |\n| --- | --- |\n| 1 | 2 |\n", null, { gfm: true }).tokens;
    let textCount = 0;
    walk(tokens, {
      inline(t) {
        if (t.type === TokenType.Text) textCount++;
        return undefined;
      },
    });
    expect(textCount).toBe(4);
  });
});

describe("applyPlugins", () => {
  it("runs plugins in sequence and threads meta", () => {
    const tokens = parse("x\n").tokens;
    const p1 = makePlugin("p1", (t, ctx) => {
      ctx.meta["count"] = ((ctx.meta["count"] as number) ?? 0) + 1;
      return t;
    });
    const p2 = makePlugin("p2", (t, ctx) => {
      ctx.meta["count"] = (ctx.meta["count"] as number) + 1;
      return t;
    });
    const result = applyPlugins(tokens, [p1, p2]);
    expect(result.meta["count"]).toBe(2);
  });

  it("empty plugin list returns input unchanged", () => {
    const tokens = parse("y\n").tokens;
    const result = applyPlugins(tokens, []);
    expect(result.tokens).toBe(tokens);
  });
});

describe("applyPlugins — sanitize-last ordering", () => {
  it("accepts a pipeline ending with sanitize", () => {
    const tokens = parse("z\n").tokens;
    const first = makePlugin("first", (t) => t);
    const sanitizePlugin = makePlugin("sanitize", (t) => t);
    const result = applyPlugins(tokens, [first, sanitizePlugin]);
    expect(result.tokens).toBe(tokens);
  });

  it("accepts sanitize as the sole plugin", () => {
    const tokens = parse("z\n").tokens;
    const sanitizePlugin = makePlugin("sanitize", (t) => t);
    const result = applyPlugins(tokens, [sanitizePlugin]);
    expect(result.tokens).toBe(tokens);
  });

  it("accepts a pipeline without any sanitize plugin", () => {
    const tokens = parse("z\n").tokens;
    const p1 = makePlugin("p1", (t) => t);
    const p2 = makePlugin("p2", (t) => t);
    const result = applyPlugins(tokens, [p1, p2]);
    expect(result.tokens).toBe(tokens);
  });

  it("throws sanitize-not-last when sanitize is not the final plugin", () => {
    const sanitizePlugin = makePlugin("sanitize", (t) => t);
    const after = makePlugin("after", (t) => t);
    expect(() => applyPlugins([], [sanitizePlugin, after])).toThrow(StreamdPluginAbiError);
  });

  it("sanitize-not-last error carries plugin name and kind", () => {
    const sanitizePlugin = makePlugin("sanitize", (t) => t);
    const after = makePlugin("after", (t) => t);
    try {
      applyPlugins([], [sanitizePlugin, after]);
    } catch (err) {
      const e = err as StreamdPluginAbiError;
      expect(e.kind).toBe("sanitize-not-last");
      expect(e.pluginName).toBe("sanitize");
      expect(e.source).toBe("@streamd/plugins");
      return;
    }
    throw new Error("expected throw");
  });

  it("throws sanitize-not-last when sanitize is at the first of three", () => {
    const sanitizePlugin = makePlugin("sanitize", (t) => t);
    const p2 = makePlugin("p2", (t) => t);
    const p3 = makePlugin("p3", (t) => t);
    expect(() => applyPlugins([], [sanitizePlugin, p2, p3])).toThrow(StreamdPluginAbiError);
  });
});

describe("applyPlugins — transform error isolation", () => {
  it("wraps a thrown transform error in StreamdPluginAbiError", () => {
    const boom = makePlugin("boom", () => {
      throw new Error("kaboom");
    });
    expect(() => applyPlugins([], [boom])).toThrow(StreamdPluginAbiError);
  });

  it("wrapped error carries kind, plugin name, and original error as cause", () => {
    const original = new Error("kaboom");
    const boom = makePlugin("boom", () => {
      throw original;
    });
    try {
      applyPlugins([], [boom]);
    } catch (err) {
      const e = err as StreamdPluginAbiError;
      expect(e.kind).toBe("transform-failed");
      expect(e.pluginName).toBe("boom");
      expect(e.cause).toBe(original);
      expect(e.message).toContain("boom");
      expect(e.message).toContain("kaboom");
      return;
    }
    throw new Error("expected throw");
  });

  it("non-Error thrown values are still wrapped and carried on cause", () => {
    const boom = makePlugin("stringThrower", () => throwValue("bare string"));
    try {
      applyPlugins([], [boom]);
    } catch (err) {
      const e = err as StreamdPluginAbiError;
      expect(e.kind).toBe("transform-failed");
      expect(e.pluginName).toBe("stringThrower");
      expect(e.cause).toBe("bare string");
      expect(e.message).toContain("bare string");
      return;
    }
    throw new Error("expected throw");
  });
});

describe("composePlugins", () => {
  it("runs composed plugins in order", () => {
    const tokens = parse("hello\n").tokens;
    const linkify = makePlugin("linkify", (ts) =>
      walk(ts, {
        inline(t) {
          if (t.type !== TokenType.Text || !t.content.includes("hello")) return undefined;
          return {
            type: TokenType.Link,
            href: "/h",
            title: "",
            children: [t],
          } as LinkToken;
        },
      }),
    );
    const addRel = makePlugin("addRel", (ts) =>
      walk(ts, {
        inline(t) {
          if (t.type !== TokenType.Link) return undefined;
          const link = t as LinkToken;
          return { ...link, meta: { ...(link.meta ?? {}), rel: "author" } };
        },
      }),
    );
    const composed = composePlugins("linkify+rel", [linkify, addRel]);
    const out = composed.transform(tokens, { meta: {} });
    const para = out[0];
    if (para.type !== TokenType.Paragraph) throw new Error("expected paragraph");
    const link = para.children[0] as LinkToken;
    expect(link.type).toBe(TokenType.Link);
    expect(link.meta?.rel).toBe("author");
  });

  it("composed plugin has its own requires declaration", () => {
    const composed = composePlugins("composed", []);
    expect(composed.requires.tokenSchema).toBe(TOKEN_SCHEMA_VERSION);
  });
});
