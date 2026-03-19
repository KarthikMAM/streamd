import { describe, expect, it } from "vitest";
import { TokenType } from "../../types/token-type";
import { scanHtmlInline } from "./html";

describe("scanHtmlInline", () => {
  it("should scan open tag <div>", () => {
    const result = scanHtmlInline("<div>", 0, 5);
    expect(result).not.toBeNull();
    expect(result?.token.type).toBe(TokenType.HtmlInline);
    if (result?.token.type === TokenType.HtmlInline) {
      expect(result?.token.content).toBe("<div>");
    }
  });

  it("should scan self-closing tag <br/>", () => {
    const result = scanHtmlInline("<br/>", 0, 5);
    expect(result).not.toBeNull();
    if (result?.token.type === TokenType.HtmlInline) {
      expect(result?.token.content).toBe("<br/>");
    }
  });

  it("should scan close tag </div>", () => {
    const result = scanHtmlInline("</div>", 0, 6);
    expect(result).not.toBeNull();
    if (result?.token.type === TokenType.HtmlInline) {
      expect(result?.token.content).toBe("</div>");
    }
  });

  it("should scan HTML comment <!-- -->", () => {
    const result = scanHtmlInline("<!-- comment -->", 0, 16);
    expect(result).not.toBeNull();
    if (result?.token.type === TokenType.HtmlInline) {
      expect(result?.token.content).toBe("<!-- comment -->");
    }
  });

  it("should scan processing instruction <?xml?>", () => {
    const result = scanHtmlInline("<?xml?>", 0, 7);
    expect(result).not.toBeNull();
    if (result?.token.type === TokenType.HtmlInline) {
      expect(result?.token.content).toBe("<?xml?>");
    }
  });

  it("should scan declaration <!DOCTYPE html>", () => {
    const result = scanHtmlInline("<!DOCTYPE html>", 0, 15);
    expect(result).not.toBeNull();
  });

  it("should scan CDATA <![CDATA[...]]>", () => {
    const result = scanHtmlInline("<![CDATA[data]]>", 0, 16);
    expect(result).not.toBeNull();
  });

  it("should scan tag with attributes", () => {
    const result = scanHtmlInline('<a href="url">', 0, 14);
    expect(result).not.toBeNull();
    if (result?.token.type === TokenType.HtmlInline) {
      expect(result?.token.content).toBe('<a href="url">');
    }
  });

  it("should return null for < at end of string", () => {
    expect(scanHtmlInline("<", 0, 1)).toBeNull();
  });

  it("should return null for < followed by digit", () => {
    expect(scanHtmlInline("<3", 0, 2)).toBeNull();
  });

  it("should reject invalid comment <!--->", () => {
    expect(scanHtmlInline("<!-->", 0, 5)).toBeNull();
  });

  it("should return null for unclosed tag", () => {
    expect(scanHtmlInline("<div", 0, 4)).toBeNull();
  });

  it("should return null for unclosed comment", () => {
    expect(scanHtmlInline("<!-- no close", 0, 13)).toBeNull();
  });
});
