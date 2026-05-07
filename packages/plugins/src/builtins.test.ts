/**
 * Unit tests for built-in plugins.
 *
 * @module builtins.test
 */
import {
  type CodeBlockToken,
  type HeadingToken,
  type LinkToken,
  parse,
  type TokensList,
  TokenType,
} from "@streamd/parser";
import { describe, expect, it } from "vitest";
import {
  frontmatter,
  headingAnchors,
  highlightCode,
  isSafeAttributeName,
  linkAttributes,
  preprocessSource,
  SAFE_ATTR_ALLOWLIST,
  sanitize,
} from "./index";
import { applyPlugins } from "./walk";

describe("headingAnchors", () => {
  it("assigns a github-style slug id", () => {
    const tokens = parse("# Hello World!\n").tokens;
    const out = applyPlugins(tokens, [headingAnchors()]).tokens;
    const heading = out[0] as HeadingToken;
    expect(heading.meta?.id).toBe("hello-world");
  });

  it("suffixes duplicate slugs", () => {
    const tokens = parse("# A\n\n# A\n\n# A\n").tokens;
    const out = applyPlugins(tokens, [headingAnchors()]).tokens;
    expect((out[0] as HeadingToken).meta?.id).toBe("a");
    expect((out[1] as HeadingToken).meta?.id).toBe("a-2");
    expect((out[2] as HeadingToken).meta?.id).toBe("a-3");
  });

  it("respects maxLevel", () => {
    const tokens = parse("## kept\n\n#### skipped\n").tokens;
    const out = applyPlugins(tokens, [headingAnchors({ maxLevel: 2 })]).tokens;
    expect((out[0] as HeadingToken).meta?.id).toBe("kept");
    expect((out[1] as HeadingToken).meta?.id).toBeUndefined();
  });

  it("accepts a custom slug function", () => {
    const tokens = parse("# Weird Title\n").tokens;
    const out = applyPlugins(tokens, [headingAnchors({ slug: (t) => `h-${t.length}` })]).tokens;
    expect((out[0] as HeadingToken).meta?.id).toBe("h-11");
  });
});

describe("linkAttributes", () => {
  it("adds rel+target to external http links", () => {
    const tokens = parse("[gh](https://github.com)\n").tokens;
    const out = applyPlugins(tokens, [linkAttributes()]).tokens;
    const link = findLink(out);
    expect(link.meta?.rel).toBe("noopener noreferrer");
    expect(link.meta?.target).toBe("_blank");
  });

  it("does not touch in-page anchor links", () => {
    const tokens = parse("[here](#section)\n").tokens;
    const out = applyPlugins(tokens, [linkAttributes()]).tokens;
    const link = findLink(out);
    expect(link.meta?.rel).toBeUndefined();
    expect(link.meta?.target).toBeUndefined();
  });

  it("adds anchor className when configured", () => {
    const tokens = parse("[top](#top)\n").tokens;
    const out = applyPlugins(tokens, [linkAttributes({ anchorClassName: "anchor" })]).tokens;
    expect(findLink(out).meta?.className).toBe("anchor");
  });

  it("accepts a custom classifier", () => {
    const tokens = parse("[r](relative.md)\n").tokens;
    const out = applyPlugins(tokens, [
      linkAttributes({ classify: () => ({ isExternal: true, isAnchor: false }) }),
    ]).tokens;
    expect(findLink(out).meta?.rel).toBe("noopener noreferrer");
  });
});

describe("highlightCode", () => {
  it("stores pre-rendered html on code-block meta", () => {
    const tokens = parse("```js\nlet x=1;\n```\n").tokens;
    const out = applyPlugins(tokens, [
      highlightCode({
        highlight: (code, lang) => `<pre class="hl-${lang}">${code}</pre>`,
      }),
    ]).tokens;
    const block = out[0] as CodeBlockToken;
    expect(block.meta?.html).toBe('<pre class="hl-js">let x=1;\n</pre>');
  });

  it("skips code blocks without a language by default", () => {
    const tokens = parse("```\nplain\n```\n").tokens;
    const out = applyPlugins(tokens, [highlightCode({ highlight: () => "<x>" })]).tokens;
    expect((out[0] as CodeBlockToken).meta?.html).toBeUndefined();
  });

  it("includes unknown-lang blocks when includeUnknown=true", () => {
    const tokens = parse("```\nplain\n```\n").tokens;
    const out = applyPlugins(tokens, [
      highlightCode({ highlight: () => "<x>", includeUnknown: true }),
    ]).tokens;
    expect((out[0] as CodeBlockToken).meta?.html).toBe("<x>");
  });

  it("leaves token unchanged when highlighter returns null", () => {
    const tokens = parse("```js\nx\n```\n").tokens;
    const out = applyPlugins(tokens, [highlightCode({ highlight: () => null })]).tokens;
    expect((out[0] as CodeBlockToken).meta?.html).toBeUndefined();
  });
});

describe("sanitize", () => {
  it("drops html blocks by default", () => {
    const tokens = parse("<div>danger</div>\n\nsafe\n").tokens;
    const out = applyPlugins(tokens, [sanitize()]).tokens;
    expect(out.some((t) => t.type === TokenType.HtmlBlock)).toBe(false);
  });

  it("preserves html blocks when allowRawHtml=true", () => {
    const tokens = parse("<div>ok</div>\n\nsafe\n").tokens;
    const out = applyPlugins(tokens, [sanitize({ allowRawHtml: true })]).tokens;
    expect(out.some((t) => t.type === TokenType.HtmlBlock)).toBe(true);
  });

  it("rewrites javascript: links to fallback", () => {
    const tokens = parse("[bad](javascript:alert(1))\n").tokens;
    const out = applyPlugins(tokens, [sanitize()]).tokens;
    expect(findLink(out).href).toBe("#");
  });

  it("leaves safe http links untouched", () => {
    const tokens = parse("[ok](https://example.com)\n").tokens;
    const out = applyPlugins(tokens, [sanitize()]).tokens;
    expect(findLink(out).href).toBe("https://example.com");
  });

  it("allows custom protocol list", () => {
    const tokens = parse("[x](custom:foo)\n").tokens;
    const out = applyPlugins(tokens, [sanitize({ allowedProtocols: ["custom:"] })]).tokens;
    expect(findLink(out).href).toBe("custom:foo");
  });

  it("strips meta.html from every token when allowRawHtml is false", () => {
    const tokens = parse("# heading\n\npara\n").tokens;
    const poisoned = tokens.map((t) => ({ ...t, meta: { html: "<script>alert(1)</script>" } }));
    const out = applyPlugins(poisoned as TokensList, [sanitize()]).tokens;
    for (const token of out) {
      expect(token.meta?.html).toBeUndefined();
    }
  });

  it("preserves meta.html when allowRawHtml is true", () => {
    const tokens = parse("# heading\n").tokens;
    const poisoned = tokens.map((t) => ({ ...t, meta: { html: "<b>ok</b>" } }));
    const out = applyPlugins(poisoned as TokensList, [sanitize({ allowRawHtml: true })]).tokens;
    expect(out[0]?.meta?.html).toBe("<b>ok</b>");
  });

  it("removes disallowed keys from meta.attrs and keeps allowed ones", () => {
    const tokens = parse("x\n").tokens;
    const poisoned = tokens.map((t) => ({
      ...t,
      meta: {
        attrs: {
          onclick: "steal()",
          onerror: "oops()",
          formaction: "http://evil",
          class: "kept",
          id: "also-kept",
          title: "still-here",
          "data-id": "42",
          "aria-label": "heading",
        },
      },
    }));
    const out = applyPlugins(poisoned as TokensList, [sanitize()]).tokens;
    const attrs = out[0]?.meta?.attrs;
    expect(attrs).toBeDefined();
    expect(Object.keys(attrs as Record<string, string>).sort()).toEqual([
      "aria-label",
      "class",
      "data-id",
      "id",
      "title",
    ]);
    expect((attrs as Record<string, string>)["onclick"]).toBeUndefined();
    expect((attrs as Record<string, string>)["onerror"]).toBeUndefined();
    expect((attrs as Record<string, string>)["formaction"]).toBeUndefined();
  });

  it("leaves meta unchanged when every attr key is already in the allowlist", () => {
    const tokens = parse("x\n").tokens;
    const attrs = { class: "c", id: "i", "data-foo": "bar" };
    const poisoned = tokens.map((t) => ({ ...t, meta: { attrs } }));
    const out = applyPlugins(poisoned as TokensList, [sanitize()]).tokens;
    expect(out[0]?.meta?.attrs).toBe(attrs);
  });

  it("walks inline tokens too when cleaning meta", () => {
    const tokens = parse("hello\n").tokens;
    const para = tokens[0];
    if (para?.type !== TokenType.Paragraph) throw new Error("expected paragraph");
    const poisonedInline = para.children.map((c) => ({ ...c, meta: { html: "<script>" } }));
    const poisoned = [{ ...para, children: poisonedInline }];
    const out = applyPlugins(poisoned as TokensList, [sanitize()]).tokens;
    const outPara = out[0];
    if (outPara?.type !== TokenType.Paragraph) throw new Error("expected paragraph");
    for (const inline of outPara.children) {
      expect(inline.meta?.html).toBeUndefined();
    }
  });
});

describe("isSafeAttributeName", () => {
  it("accepts the exact canonical allowlist", () => {
    for (const name of ["class", "id", "title", "alt", "lang", "dir", "role", "href", "src"]) {
      expect(isSafeAttributeName(name)).toBe(true);
    }
  });

  it("accepts data-* and aria-* prefixed names", () => {
    expect(isSafeAttributeName("data-id")).toBe(true);
    expect(isSafeAttributeName("data-anything-here")).toBe(true);
    expect(isSafeAttributeName("aria-label")).toBe(true);
    expect(isSafeAttributeName("aria-describedby")).toBe(true);
  });

  it("rejects bare data- and aria- prefixes without a suffix", () => {
    expect(isSafeAttributeName("data-")).toBe(false);
    expect(isSafeAttributeName("aria-")).toBe(false);
  });

  it("rejects event handlers, style, formaction, and other dangerous attrs", () => {
    for (const name of ["onclick", "onerror", "onload", "style", "formaction", "srcdoc"]) {
      expect(isSafeAttributeName(name)).toBe(false);
    }
  });

  it("rejects empty string", () => {
    expect(isSafeAttributeName("")).toBe(false);
  });

  it("is case-sensitive", () => {
    expect(isSafeAttributeName("CLASS")).toBe(false);
    expect(isSafeAttributeName("Data-id")).toBe(false);
  });

  it("SAFE_ATTR_ALLOWLIST exposes the exact-match names", () => {
    expect(SAFE_ATTR_ALLOWLIST.has("class")).toBe(true);
    expect(SAFE_ATTR_ALLOWLIST.has("onclick")).toBe(false);
  });
});

describe("frontmatter", () => {
  it("strips frontmatter and returns parsed fields", () => {
    const source = "---\ntitle: Hello\nauthor: me\n---\nbody\n";
    const result = preprocessSource(source);
    expect(result.source).toBe("body\n");
    expect(result.frontmatter).toEqual({ title: "Hello", author: "me" });
  });

  it("handles no frontmatter gracefully", () => {
    const source = "# hi\n";
    const result = preprocessSource(source);
    expect(result.source).toBe(source);
    expect(result.frontmatter).toEqual({});
  });

  it("ignores malformed frontmatter (no closing ---)", () => {
    const source = "---\nkey: v\nbody without close\n";
    const result = preprocessSource(source);
    expect(result.source).toBe(source);
  });

  it("strips quotes from scalar values", () => {
    const source = "---\nname: \"Alice\"\ntitle: 'Wonderland'\n---\nbody\n";
    const result = preprocessSource(source);
    expect(result.frontmatter).toEqual({ name: "Alice", title: "Wonderland" });
  });

  it("plugin transform is a no-op", () => {
    const tokens = parse("body\n").tokens;
    const out = frontmatter().transform(tokens, { meta: {} });
    expect(out).toBe(tokens);
  });
});

function findLink(tokens: TokensList): LinkToken {
  for (const t of tokens) {
    if (t.type === TokenType.Paragraph) {
      for (const inline of t.children) {
        if (inline.type === TokenType.Link) return inline;
      }
    }
  }
  throw new Error("no link");
}
