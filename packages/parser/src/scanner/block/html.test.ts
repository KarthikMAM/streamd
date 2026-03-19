import { describe, expect, it } from "vitest";
import { matchHtmlBlockClose, matchHtmlBlockOpen } from "./html";

describe("matchHtmlBlockOpen", () => {
  it("should return 1 for <pre>", () => {
    expect(matchHtmlBlockOpen("<pre>", 0, 5, false)).toBe(1);
  });

  it("should return 1 for </script>", () => {
    expect(matchHtmlBlockOpen("</script>", 0, 9, false)).toBe(1);
  });

  it("should return 1 case-insensitively for <STYLE>", () => {
    expect(matchHtmlBlockOpen("<STYLE>", 0, 7, false)).toBe(1);
  });

  it("should return 2 for <!--", () => {
    expect(matchHtmlBlockOpen("<!-- x", 0, 6, false)).toBe(2);
  });

  it("should return 3 for <?", () => {
    expect(matchHtmlBlockOpen("<?xml", 0, 5, false)).toBe(3);
  });

  it("should return 4 for <!D", () => {
    expect(matchHtmlBlockOpen("<!DOCTYPE>", 0, 10, false)).toBe(4);
  });

  it("should return 5 for <![CDATA[", () => {
    expect(matchHtmlBlockOpen("<![CDATA[x]]>", 0, 13, false)).toBe(5);
  });

  it("should return 6 for known block tag <div>", () => {
    expect(matchHtmlBlockOpen("<div>", 0, 5, false)).toBe(6);
  });

  it("should return 6 for </div>", () => {
    expect(matchHtmlBlockOpen("</div>", 0, 6, false)).toBe(6);
  });

  it("should return 7 for unknown tag not in paragraph", () => {
    expect(matchHtmlBlockOpen("<custom>", 0, 8, false)).toBe(7);
  });

  it("should return 0 for unknown tag in paragraph", () => {
    expect(matchHtmlBlockOpen("<custom>", 0, 8, true)).toBe(0);
  });

  it("should return 0 for non-< start", () => {
    expect(matchHtmlBlockOpen("text", 0, 4, false)).toBe(0);
  });

  it("should return 0 for < at end", () => {
    expect(matchHtmlBlockOpen("<", 0, 1, false)).toBe(0);
  });
});

describe("matchHtmlBlockClose", () => {
  it("should detect </pre> for type 1", () => {
    expect(matchHtmlBlockClose("text </pre>", 0, 11, 1)).toBe(true);
  });

  it("should detect --> for type 2", () => {
    expect(matchHtmlBlockClose("text -->", 0, 8, 2)).toBe(true);
  });

  it("should detect ?> for type 3", () => {
    expect(matchHtmlBlockClose("text ?>", 0, 7, 3)).toBe(true);
  });

  it("should detect > for type 4", () => {
    expect(matchHtmlBlockClose("text >", 0, 6, 4)).toBe(true);
  });

  it("should detect ]]> for type 5", () => {
    expect(matchHtmlBlockClose("text ]]>", 0, 8, 5)).toBe(true);
  });

  it("should return false for type 6", () => {
    expect(matchHtmlBlockClose("anything", 0, 8, 6)).toBe(false);
  });

  it("should return false when close sequence not found", () => {
    expect(matchHtmlBlockClose("no close here", 0, 13, 2)).toBe(false);
  });
});

it("should detect type 7 for self-closing tag", () => {
  expect(matchHtmlBlockOpen("<custom/>", 0, 9, false)).toBe(7);
});

it("should detect type 7 for tag with attributes", () => {
  expect(matchHtmlBlockOpen('<custom class="foo">', 0, 20, false)).toBe(7);
});

it("should detect type 7 for tag with unquoted attribute", () => {
  expect(matchHtmlBlockOpen("<custom id=bar>", 0, 15, false)).toBe(7);
});

it("should detect type 7 for tag with single-quoted attribute", () => {
  expect(matchHtmlBlockOpen("<custom id='bar'>", 0, 17, false)).toBe(7);
});

it("should detect type 7 for close tag with spaces", () => {
  expect(matchHtmlBlockOpen("</custom >", 0, 10, false)).toBe(7);
});

it("should detect type 4 for <!DOCTYPE>", () => {
  expect(matchHtmlBlockOpen("<!DOCTYPE html>", 0, 15, false)).toBe(4);
});

it("should detect type 1 for </script>", () => {
  expect(matchHtmlBlockOpen("</script>", 0, 9, false)).toBe(1);
});

it("should detect type 6 for </div>", () => {
  expect(matchHtmlBlockOpen("</div>", 0, 6, false)).toBe(6);
});

it("should detect type 6 for <div/>", () => {
  expect(matchHtmlBlockOpen("<div/>", 0, 6, false)).toBe(6);
});
