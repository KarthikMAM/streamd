/**
 * Test input generators for benchmarks.
 *
 * @module bench/generate
 */

/** Generate mixed markdown content of approximately `sizeKb` kilobytes. */
export function generateMixed(sizeKb: number): string {
  const parts: Array<string> = [];
  let currentSize = 0;

  while (currentSize < sizeKb * 1024) {
    parts.push("# Heading Level 1\n\n");
    parts.push("This is a paragraph with **bold**, *italic*, and `code` inline.\n");
    parts.push("Another line with [a link](https://example.com) and an ![image](img.png).\n\n");
    parts.push("> Blockquote with *emphasis* inside.\n\n");
    parts.push("- Item one\n- Item two\n- Item three\n\n");
    parts.push("1. First\n2. Second\n3. Third\n\n");
    parts.push("```js\nconst x = 1;\nconsole.log(x);\n```\n\n");
    parts.push("---\n\n");
    parts.push("Plain text paragraph without any special characters at all. ".repeat(3) + "\n\n");
    currentSize = parts.join("").length;
  }

  return parts.join("").slice(0, sizeKb * 1024);
}

/** Generate paragraph-heavy content. */
export function generateParagraphs(sizeKb: number): string {
  const parts: Array<string> = [];
  let currentSize = 0;
  while (currentSize < sizeKb * 1024) {
    parts.push("This is a paragraph with **bold**, *italic*, and `code` inline formatting.\n");
    parts.push("Another line continuing the same paragraph with more text content.\n\n");
    currentSize = parts.join("").length;
  }
  return parts.join("").slice(0, sizeKb * 1024);
}

/** Generate code-heavy content. */
export function generateCode(sizeKb: number): string {
  const parts: Array<string> = [];
  let currentSize = 0;
  while (currentSize < sizeKb * 1024) {
    parts.push("```js\n");
    for (let i = 0; i < 10; i++) parts.push(`const x${i} = ${i};\n`);
    parts.push("```\n\n");
    currentSize = parts.join("").length;
  }
  return parts.join("").slice(0, sizeKb * 1024);
}
