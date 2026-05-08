/**
 * Unit tests for `token-factory.ts`.
 *
 * @module token-factory.test
 */
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
  createImageToken,
  createLinkToken,
  createListItemToken,
  createListToken,
  createMathBlockToken,
  createMathInlineToken,
  createParagraphToken,
  createSpaceToken,
  createStrikethroughToken,
  createStrongToken,
  createTableToken,
  createTextToken,
} from "./token-factory";

describe("inline token factories", () => {
  it("createTextToken sets type and content", () => {
    const t = createTextToken("hello");
    expect(t.type).toBe(TokenType.Text);
    expect(t.content).toBe("hello");
  });

  it("createHardbreakToken sets type to hardbreak", () => {
    expect(createHardbreakToken().type).toBe(TokenType.Hardbreak);
  });

  it("createCodeSpanToken sets type and content", () => {
    const t = createCodeSpanToken("code");
    expect(t.type).toBe(TokenType.CodeSpan);
    expect(t.content).toBe("code");
  });

  it("createEmToken sets type and children", () => {
    const children = [createTextToken("em")];
    const t = createEmToken(children);
    expect(t.type).toBe(TokenType.Em);
    expect(t.children).toBe(children);
  });

  it("createStrongToken sets type and children", () => {
    const children = [createTextToken("strong")];
    const t = createStrongToken(children);
    expect(t.type).toBe(TokenType.Strong);
    expect(t.children).toBe(children);
  });

  it("createStrikethroughToken sets type and children", () => {
    const children = [createTextToken("del")];
    const t = createStrikethroughToken(children);
    expect(t.type).toBe(TokenType.Strikethrough);
    expect(t.children).toBe(children);
  });

  it("createLinkToken sets all fields", () => {
    const children = [createTextToken("text")];
    const t = createLinkToken("http://x", "title", children);
    expect(t.type).toBe(TokenType.Link);
    expect(t.href).toBe("http://x");
    expect(t.title).toBe("title");
    expect(t.children).toBe(children);
  });

  it("createImageToken sets all fields", () => {
    const t = createImageToken("img.png", "alt", "title");
    expect(t.type).toBe(TokenType.Image);
    expect(t.src).toBe("img.png");
    expect(t.alt).toBe("alt");
    expect(t.title).toBe("title");
  });

  it("createEscapeToken sets type and content", () => {
    const t = createEscapeToken("*");
    expect(t.type).toBe(TokenType.Escape);
    expect(t.content).toBe("*");
  });

  it("createMathInlineToken sets type and content", () => {
    const t = createMathInlineToken("x^2");
    expect(t.type).toBe(TokenType.MathInline);
    expect(t.content).toBe("x^2");
  });
});

describe("block token factories", () => {
  it("createHeadingToken sets level and children", () => {
    const children = [createTextToken("heading")];
    const t = createHeadingToken(2, children);
    expect(t.type).toBe(TokenType.Heading);
    expect(t.level).toBe(2);
    expect(t.children).toBe(children);
  });

  it("createParagraphToken sets children", () => {
    const children = [createTextToken("para")];
    const t = createParagraphToken(children);
    expect(t.type).toBe(TokenType.Paragraph);
    expect(t.children).toBe(children);
  });

  it("createCodeBlockToken sets lang and content", () => {
    const t = createCodeBlockToken("js", "code\n");
    expect(t.type).toBe(TokenType.CodeBlock);
    expect(t.lang).toBe("js");
    expect(t.content).toBe("code\n");
  });

  it("createHrToken sets type to hr", () => {
    expect(createHrToken().type).toBe(TokenType.Hr);
  });

  it("createSpaceToken sets type to space", () => {
    expect(createSpaceToken().type).toBe(TokenType.Space);
  });

  it("createBlockquoteToken sets children", () => {
    const t = createBlockquoteToken([createHrToken()]);
    expect(t.type).toBe(TokenType.Blockquote);
    expect(t.children.length).toBe(1);
  });

  it("createListToken sets all fields", () => {
    const items = [createListItemToken(null, [])];
    const t = createListToken(true, 5, false, items);
    expect(t.type).toBe(TokenType.List);
    expect(t.ordered).toBe(true);
    expect(t.start).toBe(5);
    expect(t.tight).toBe(false);
    expect(t.children).toBe(items);
  });

  it("createListItemToken sets checked and children", () => {
    const t = createListItemToken(true, []);
    expect(t.type).toBe(TokenType.ListItem);
    expect(t.checked).toBe(true);
  });

  it("createTableToken sets align, head, rows", () => {
    const t = createTableToken(["left"], [[]], []);
    expect(t.type).toBe(TokenType.Table);
    expect(t.align).toEqual(["left"]);
  });

  it("createMathBlockToken sets content", () => {
    const t = createMathBlockToken("x^2\n");
    expect(t.type).toBe(TokenType.MathBlock);
    expect(t.content).toBe("x^2\n");
  });
});
