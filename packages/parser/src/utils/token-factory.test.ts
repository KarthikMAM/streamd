import { describe, expect, it } from "vitest";
import { TokenType } from "../types/token-type";
import {
  createBlockquoteToken,
  createCodeBlockToken,
  createCodeSpanToken,
  createEmToken,
  createEscapeToken,
  createHardbreakToken,
  createHeadingToken,
  createHrToken,
  createHtmlBlockToken,
  createHtmlInlineToken,
  createImageToken,
  createLinkToken,
  createListItemToken,
  createListToken,
  createMathBlockToken,
  createMathInlineToken,
  createParagraphToken,
  createSoftbreakToken,
  createSpaceToken,
  createStrikethroughToken,
  createStrongToken,
  createTableToken,
  createTextToken,
} from "./token-factory";

describe("inline token factories", () => {
  it("createTextToken should set type and content", () => {
    const t = createTextToken("hello");
    expect(t.type).toBe(TokenType.Text);
    expect(t.content).toBe("hello");
  });

  it("createSoftbreakToken should set type", () => {
    expect(createSoftbreakToken().type).toBe(TokenType.Softbreak);
  });

  it("createHardbreakToken should set type", () => {
    expect(createHardbreakToken().type).toBe(TokenType.Hardbreak);
  });

  it("createCodeSpanToken should set type and content", () => {
    const t = createCodeSpanToken("code");
    expect(t.type).toBe(TokenType.CodeSpan);
    expect(t.content).toBe("code");
  });

  it("createEmToken should set type and children", () => {
    const children = [createTextToken("em")];
    const t = createEmToken(children);
    expect(t.type).toBe(TokenType.Em);
    expect(t.children).toBe(children);
  });

  it("createStrongToken should set type and children", () => {
    const children = [createTextToken("strong")];
    const t = createStrongToken(children);
    expect(t.type).toBe(TokenType.Strong);
    expect(t.children).toBe(children);
  });

  it("createStrikethroughToken should set type and children", () => {
    const children = [createTextToken("del")];
    const t = createStrikethroughToken(children);
    expect(t.type).toBe(TokenType.Strikethrough);
    expect(t.children).toBe(children);
  });

  it("createLinkToken should set all fields", () => {
    const children = [createTextToken("text")];
    const t = createLinkToken("http://x", "title", children);
    expect(t.type).toBe(TokenType.Link);
    expect(t.href).toBe("http://x");
    expect(t.title).toBe("title");
    expect(t.children).toBe(children);
  });

  it("createImageToken should set all fields", () => {
    const t = createImageToken("img.png", "alt", "title");
    expect(t.type).toBe(TokenType.Image);
    expect(t.src).toBe("img.png");
    expect(t.alt).toBe("alt");
    expect(t.title).toBe("title");
  });

  it("createHtmlInlineToken should set type and content", () => {
    const t = createHtmlInlineToken("<br>");
    expect(t.type).toBe(TokenType.HtmlInline);
    expect(t.content).toBe("<br>");
  });

  it("createEscapeToken should set type and content", () => {
    const t = createEscapeToken("*");
    expect(t.type).toBe(TokenType.Escape);
    expect(t.content).toBe("*");
  });

  it("createMathInlineToken should set type and content", () => {
    const t = createMathInlineToken("x^2");
    expect(t.type).toBe(TokenType.MathInline);
    expect(t.content).toBe("x^2");
  });
});

describe("block token factories", () => {
  it("createHeadingToken should set level and children", () => {
    const children = [createTextToken("heading")];
    const t = createHeadingToken(2, children);
    expect(t.type).toBe(TokenType.Heading);
    expect(t.level).toBe(2);
    expect(t.children).toBe(children);
  });

  it("createParagraphToken should set children", () => {
    const children = [createTextToken("para")];
    const t = createParagraphToken(children);
    expect(t.type).toBe(TokenType.Paragraph);
    expect(t.children).toBe(children);
  });

  it("createCodeBlockToken should set lang, info, content", () => {
    const t = createCodeBlockToken("js", "js highlight", "code\n");
    expect(t.type).toBe(TokenType.CodeBlock);
    expect(t.lang).toBe("js");
    expect(t.info).toBe("js highlight");
    expect(t.content).toBe("code\n");
  });

  it("createHtmlBlockToken should set content", () => {
    const t = createHtmlBlockToken("<div>\n</div>\n");
    expect(t.type).toBe(TokenType.HtmlBlock);
    expect(t.content).toBe("<div>\n</div>\n");
  });

  it("createHrToken should set type", () => {
    expect(createHrToken().type).toBe(TokenType.Hr);
  });

  it("createSpaceToken should set type", () => {
    expect(createSpaceToken().type).toBe(TokenType.Space);
  });

  it("createBlockquoteToken should set children", () => {
    const t = createBlockquoteToken([createHrToken()]);
    expect(t.type).toBe(TokenType.Blockquote);
    expect(t.children.length).toBe(1);
  });

  it("createListToken should set all fields", () => {
    const items = [createListItemToken(null, [])];
    const t = createListToken(true, 5, false, items);
    expect(t.type).toBe(TokenType.List);
    expect(t.ordered).toBe(true);
    expect(t.start).toBe(5);
    expect(t.tight).toBe(false);
    expect(t.children).toBe(items);
  });

  it("createListItemToken should set checked and children", () => {
    const t = createListItemToken(true, []);
    expect(t.type).toBe(TokenType.ListItem);
    expect(t.checked).toBe(true);
  });

  it("createTableToken should set align, head, rows", () => {
    const t = createTableToken(["left"], [[]], []);
    expect(t.type).toBe(TokenType.Table);
    expect(t.align).toEqual(["left"]);
  });

  it("createMathBlockToken should set content", () => {
    const t = createMathBlockToken("x^2\n");
    expect(t.type).toBe(TokenType.MathBlock);
    expect(t.content).toBe("x^2\n");
  });
});
