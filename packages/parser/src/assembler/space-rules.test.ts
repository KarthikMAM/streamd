/**
 * Tests for shouldEmitSpace — the rule set governing SpaceToken emission
 * between adjacent block tokens.
 *
 * @module assembler/space-rules.test
 */
import { describe, expect, it } from "vitest";
import { TokenType } from "../types/token-type";
import type { Token } from "../types/tokens";
import { shouldEmitSpace } from "./space-rules";

/** Create a minimal token stub with the given type for testing. */
function stubToken(type: string): Token {
  return { type } as Token;
}

describe("shouldEmitSpace", () => {
  it("returns false when prev is null", () => {
    expect(shouldEmitSpace(null, stubToken(TokenType.Paragraph))).toBe(false);
  });

  it("returns false when next is null", () => {
    expect(shouldEmitSpace(stubToken(TokenType.Paragraph), null)).toBe(false);
  });

  it("returns false for heading followed by paragraph", () => {
    expect(shouldEmitSpace(stubToken(TokenType.Heading), stubToken(TokenType.Paragraph))).toBe(
      false,
    );
  });

  it("returns false for heading followed by code_block", () => {
    expect(shouldEmitSpace(stubToken(TokenType.Heading), stubToken(TokenType.CodeBlock))).toBe(
      false,
    );
  });

  it("returns true for heading followed by hr", () => {
    expect(shouldEmitSpace(stubToken(TokenType.Heading), stubToken(TokenType.Hr))).toBe(true);
  });

  it("returns false for table followed by paragraph", () => {
    expect(shouldEmitSpace(stubToken(TokenType.Table), stubToken(TokenType.Paragraph))).toBe(false);
  });

  it("returns false for table followed by heading", () => {
    expect(shouldEmitSpace(stubToken(TokenType.Table), stubToken(TokenType.Heading))).toBe(false);
  });

  it("returns false for paragraph followed by list", () => {
    expect(shouldEmitSpace(stubToken(TokenType.Paragraph), stubToken(TokenType.List))).toBe(false);
  });

  it("returns false for paragraph followed by table", () => {
    expect(shouldEmitSpace(stubToken(TokenType.Paragraph), stubToken(TokenType.Table))).toBe(false);
  });

  it("returns false for list followed by list", () => {
    expect(shouldEmitSpace(stubToken(TokenType.List), stubToken(TokenType.List))).toBe(false);
  });

  it("returns true for paragraph followed by paragraph", () => {
    expect(shouldEmitSpace(stubToken(TokenType.Paragraph), stubToken(TokenType.Paragraph))).toBe(
      true,
    );
  });

  it("returns true for paragraph followed by heading", () => {
    expect(shouldEmitSpace(stubToken(TokenType.Paragraph), stubToken(TokenType.Heading))).toBe(
      true,
    );
  });

  it("returns true for list followed by paragraph", () => {
    expect(shouldEmitSpace(stubToken(TokenType.List), stubToken(TokenType.Paragraph))).toBe(true);
  });

  it("returns true for code_block followed by paragraph", () => {
    expect(shouldEmitSpace(stubToken(TokenType.CodeBlock), stubToken(TokenType.Paragraph))).toBe(
      true,
    );
  });

  it("returns true for hr followed by paragraph", () => {
    expect(shouldEmitSpace(stubToken(TokenType.Hr), stubToken(TokenType.Paragraph))).toBe(true);
  });
});
