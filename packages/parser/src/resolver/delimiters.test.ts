import { describe, expect, it } from "vitest";
import type { InlineNode } from "../types/internal";
import { TokenType } from "../types/token-type";
import { createTextToken } from "../utils/token-factory";
import { resolveDelimiters } from "./delimiters";

function textNode(content: string, pos: number): InlineNode {
  return {
    kind: 0,
    token: createTextToken(content),
    char: 0,
    count: 0,
    canOpen: false,
    canClose: false,
    pos,
    end: pos + content.length,
  };
}

function delimNode(
  char: number,
  count: number,
  canOpen: boolean,
  canClose: boolean,
  pos: number,
): InlineNode {
  return { kind: 1, token: null, char, count, canOpen, canClose, pos, end: pos + count };
}

describe("resolveDelimiters", () => {
  it("should wrap *foo* as Em", () => {
    const nodes: Array<InlineNode> = [
      delimNode(0x2a, 1, true, false, 0),
      textNode("foo", 1),
      delimNode(0x2a, 1, false, true, 4),
    ];
    const result = resolveDelimiters(nodes, 3, false);
    expect(result.length).toBe(1);
    expect(result[0]?.type).toBe(TokenType.Em);
  });

  it("should wrap **foo** as Strong", () => {
    const nodes: Array<InlineNode> = [
      delimNode(0x2a, 2, true, false, 0),
      textNode("foo", 2),
      delimNode(0x2a, 2, false, true, 5),
    ];
    const result = resolveDelimiters(nodes, 3, false);
    expect(result.length).toBe(1);
    expect(result[0]?.type).toBe(TokenType.Strong);
  });

  it("should wrap ~~foo~~ as Strikethrough", () => {
    const nodes: Array<InlineNode> = [
      delimNode(0x7e, 2, true, false, 0),
      textNode("foo", 2),
      delimNode(0x7e, 2, false, true, 5),
    ];
    const result = resolveDelimiters(nodes, 3, false);
    expect(result.length).toBe(1);
    expect(result[0]?.type).toBe(TokenType.Strikethrough);
  });

  it("should leave unmatched opener as text in non-streaming mode", () => {
    const nodes: Array<InlineNode> = [delimNode(0x2a, 1, true, false, 0), textNode("foo", 1)];
    const result = resolveDelimiters(nodes, 2, false);
    expect(result.length).toBe(2);
    expect(result[0]?.type).toBe(TokenType.Text);
    if (result[0]?.type === TokenType.Text) {
      expect(result[0]?.content).toBe("*");
    }
  });

  it("should auto-close unmatched opener in streaming mode", () => {
    const nodes: Array<InlineNode> = [delimNode(0x2a, 1, true, false, 0), textNode("foo", 1)];
    const result = resolveDelimiters(nodes, 2, true);
    expect(result.length).toBe(1);
    expect(result[0]?.type).toBe(TokenType.Em);
  });

  it("should handle nested emphasis *foo **bar** baz*", () => {
    const nodes: Array<InlineNode> = [
      delimNode(0x2a, 1, true, false, 0),
      textNode("foo ", 1),
      delimNode(0x2a, 2, true, false, 5),
      textNode("bar", 7),
      delimNode(0x2a, 2, false, true, 10),
      textNode(" baz", 12),
      delimNode(0x2a, 1, false, true, 16),
    ];
    const result = resolveDelimiters(nodes, 7, false);
    expect(result.length).toBe(1);
    expect(result[0]?.type).toBe(TokenType.Em);
    if (result[0]?.type === TokenType.Em) {
      const inner = result[0]?.children;
      const hasStrong = inner.some((c) => c.type === TokenType.Strong);
      expect(hasStrong).toBe(true);
    }
  });

  it("should return empty array for zero nodes", () => {
    expect(resolveDelimiters([], 0, false)).toEqual([]);
  });

  it("should pass through token nodes unchanged", () => {
    const nodes: Array<InlineNode> = [textNode("hello", 0), textNode("world", 6)];
    const result = resolveDelimiters(nodes, 2, false);
    expect(result.length).toBe(2);
    expect(result[0]?.type).toBe(TokenType.Text);
    expect(result[1]?.type).toBe(TokenType.Text);
  });

  it("should not match single ~ as strikethrough", () => {
    const nodes: Array<InlineNode> = [
      delimNode(0x7e, 1, true, false, 0),
      textNode("foo", 1),
      delimNode(0x7e, 1, false, true, 4),
    ];
    const result = resolveDelimiters(nodes, 3, false);
    expect(result.every((t) => t.type !== TokenType.Strikethrough)).toBe(true);
  });

  it("should auto-close strong opener in streaming mode", () => {
    const nodes: Array<InlineNode> = [delimNode(0x2a, 2, true, false, 0), textNode("foo", 2)];
    const result = resolveDelimiters(nodes, 2, true);
    expect(result.length).toBe(1);
    expect(result[0]?.type).toBe(TokenType.Strong);
  });

  it("should auto-close tilde opener in streaming mode", () => {
    const nodes: Array<InlineNode> = [delimNode(0x7e, 2, true, false, 0), textNode("foo", 2)];
    const result = resolveDelimiters(nodes, 2, true);
    expect(result.length).toBe(1);
    expect(result[0]?.type).toBe(TokenType.Strikethrough);
  });

  it("should auto-close opener with no following tokens as text in streaming", () => {
    const nodes: Array<InlineNode> = [delimNode(0x2a, 1, true, false, 0)];
    const result = resolveDelimiters(nodes, 1, true);
    expect(result.length).toBe(1);
    expect(result[0]?.type).toBe(TokenType.Text);
  });

  it("should handle underscore emphasis _foo_", () => {
    const nodes: Array<InlineNode> = [
      delimNode(0x5f, 1, true, false, 0),
      textNode("foo", 1),
      delimNode(0x5f, 1, false, true, 4),
    ];
    const result = resolveDelimiters(nodes, 3, false);
    expect(result.length).toBe(1);
    expect(result[0]?.type).toBe(TokenType.Em);
  });

  it("should handle delimiter run with count > 2 as text", () => {
    const nodes: Array<InlineNode> = [delimNode(0x2a, 4, true, false, 0)];
    const result = resolveDelimiters(nodes, 1, false);
    expect(result.length).toBe(1);
    expect(result[0]?.type).toBe(TokenType.Text);
    if (result[0]?.type === TokenType.Text) {
      expect(result[0].content).toBe("****");
    }
  });

  it("should handle closer with remaining count after match", () => {
    const nodes: Array<InlineNode> = [
      delimNode(0x2a, 1, true, false, 0),
      textNode("foo", 1),
      delimNode(0x2a, 3, true, true, 4),
    ];
    const result = resolveDelimiters(nodes, 3, false);
    expect(result.length).toBeGreaterThan(0);
  });
});
