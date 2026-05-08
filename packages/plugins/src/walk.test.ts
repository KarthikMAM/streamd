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
        return t.type === TokenType.Paragraph || t.type === TokenType.Space ? null : undefined;
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
    expect(() => applyPlugins([], [boom])).toThrow(
      expect.objectContaining({
        kind: "transform-failed",
        pluginName: "boom",
        cause: original,
        message: expect.stringMatching(/boom.*kaboom|kaboom.*boom/),
      }),
    );
  });

  it("non-Error thrown values are still wrapped and carried on cause", () => {
    const boom = makePlugin("stringThrower", () => throwValue("bare string"));
    expect(() => applyPlugins([], [boom])).toThrow(
      expect.objectContaining({
        kind: "transform-failed",
        pluginName: "stringThrower",
        cause: "bare string",
        message: expect.stringContaining("bare string"),
      }),
    );
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

describe("walk — container rebuild paths on mutation", () => {
  /**
   * A visitor that uppercases every Text token's content. This forces
   * every container token to rebuild because its children differ from
   * the input, exercising all the `if (children === token.children)`
   * false-branches in walk.ts.
   */
  const UPPERCASE_TEXT: Parameters<typeof walk>[1] = {
    inline(t) {
      if (t.type !== TokenType.Text) return undefined;
      return { ...t, content: t.content.toUpperCase() };
    },
  };

  it("rebuilds a blockquote when a nested Text child is mutated", () => {
    const tokens = parse("> hi\n").tokens;
    const out = walk(tokens, UPPERCASE_TEXT);
    expect(out).not.toBe(tokens);
    const bq = out[0];
    if (bq?.type !== TokenType.Blockquote) throw new Error("expected blockquote");
    const para = bq.children[0];
    if (para?.type !== TokenType.Paragraph) throw new Error("expected paragraph");
    const text = para.children[0];
    if (text?.type !== TokenType.Text) throw new Error("expected text");
    expect(text.content).toBe("HI");
  });

  it("rebuilds a list and every modified list item", () => {
    const tokens = parse("- one\n- two\n").tokens;
    const out = walk(tokens, UPPERCASE_TEXT);
    expect(out).not.toBe(tokens);
    const list = out[0];
    if (list?.type !== TokenType.List) throw new Error("expected list");
    expect(list.children).toHaveLength(2);
    const firstItemPara = list.children[0]?.children[0];
    if (firstItemPara?.type !== TokenType.Paragraph) throw new Error("expected paragraph");
    const firstText = firstItemPara.children[0];
    if (firstText?.type !== TokenType.Text) throw new Error("expected text");
    expect(firstText.content).toBe("ONE");
  });

  it("rebuilds a heading when its inline child is mutated", () => {
    const tokens = parse("# hello\n").tokens;
    const out = walk(tokens, UPPERCASE_TEXT);
    expect(out).not.toBe(tokens);
    const h = out[0];
    if (h?.type !== TokenType.Heading) throw new Error("expected heading");
    const text = h.children[0];
    if (text?.type !== TokenType.Text) throw new Error("expected text");
    expect(text.content).toBe("HELLO");
  });

  it("rebuilds a table's head and body cells when text is mutated", () => {
    const tokens = parse("| a | b |\n| --- | --- |\n| 1 | 2 |\n", null, { gfm: true }).tokens;
    const out = walk(tokens, UPPERCASE_TEXT);
    const table = out[0];
    if (table?.type !== TokenType.Table) throw new Error("expected table");
    const headCell = table.head[0]?.[0];
    if (headCell?.type !== TokenType.Text) throw new Error("expected head text");
    expect(headCell.content).toBe("A");
    const bodyCell = table.rows[0]?.[0]?.[0];
    if (bodyCell?.type !== TokenType.Text) throw new Error("expected body text");
    expect(bodyCell.content).toBe("1");
  });

  it("rebuilds an Em/Strong when inline children mutate", () => {
    const tokens = parse("*em* and **strong**\n").tokens;
    const out = walk(tokens, UPPERCASE_TEXT);
    const para = out[0];
    if (para?.type !== TokenType.Paragraph) throw new Error("expected paragraph");
    const em = para.children[0];
    if (em?.type !== TokenType.Em) throw new Error("expected em");
    const emText = em.children[0];
    if (emText?.type !== TokenType.Text) throw new Error("expected em text");
    expect(emText.content).toBe("EM");
    const strong = para.children[2];
    if (strong?.type !== TokenType.Strong) throw new Error("expected strong");
    const strongText = strong.children[0];
    if (strongText?.type !== TokenType.Text) throw new Error("expected strong text");
    expect(strongText.content).toBe("STRONG");
  });

  it("rebuilds a Strikethrough when child text mutates", () => {
    const tokens = parse("~~gone~~\n", null, { gfm: true }).tokens;
    const out = walk(tokens, UPPERCASE_TEXT);
    const para = out[0];
    if (para?.type !== TokenType.Paragraph) throw new Error("expected paragraph");
    const strike = para.children[0];
    if (strike?.type !== TokenType.Strikethrough) throw new Error("expected strikethrough");
    const text = strike.children[0];
    if (text?.type !== TokenType.Text) throw new Error("expected text");
    expect(text.content).toBe("GONE");
  });

  it("rebuilds a Link when its inline text child mutates", () => {
    const tokens = parse("[name](/url)\n").tokens;
    const out = walk(tokens, UPPERCASE_TEXT);
    const para = out[0];
    if (para?.type !== TokenType.Paragraph) throw new Error("expected paragraph");
    const link = para.children[0];
    if (link?.type !== TokenType.Link) throw new Error("expected link");
    const text = link.children[0];
    if (text?.type !== TokenType.Text) throw new Error("expected text");
    expect(text.content).toBe("NAME");
  });

  it("preserves reference equality when visitor returns undefined on every token", () => {
    // Control: if the visitor never changes anything, every container
    // hits the `children === token.children` true-branch and returns
    // the input unchanged.
    const tokens = parse("# hi\n\n- a\n\n> q\n").tokens;
    const out = walk(tokens, { inline: () => undefined });
    expect(out).toBe(tokens);
  });

  it("drops a token when the visitor returns null (filter mode)", () => {
    const tokens = parse("keep **drop**\n").tokens;
    const out = walk(tokens, {
      inline(t) {
        return t.type === TokenType.Strong ? null : undefined;
      },
    });
    const para = out[0];
    if (para?.type !== TokenType.Paragraph) throw new Error("expected paragraph");
    expect(para.children.find((c) => c.type === TokenType.Strong)).toBeUndefined();
    const text = para.children.find((c) => c.type === TokenType.Text);
    expect(text).toBeDefined();
  });
});
