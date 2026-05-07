/**
 * Seeded, deterministic markdown corpus generator for property-based
 * streaming-equivalence fuzzing.
 *
 * ## Determinism contract
 *
 * For any `(seed, complexity)` pair, {@link generate} returns a byte-equal
 * string across invocations, Node versions, and host OSes. The generator
 * uses a mulberry32 PRNG so it never consults `Math.random`, `Date.now`,
 * or any ambient source of nondeterminism.
 *
 * ## Structural validity
 *
 * - Every emphasis / strong / strikethrough delimiter is paired.
 * - Every fenced code block and fenced math block is closed.
 * - Every HTML block uses well-formed open/close tag pairs.
 * - Every URL uses a renderer-safe scheme — one of `https:`, `http:`,
 *   `mailto:`, `tel:`, or an in-document `#anchor`.
 * - Heading levels stay within 1–6; ordered-list markers stay at most 3
 *   digits.
 *
 * The corpus targets the audit's M3 / M4 / M5 gaps by spanning every
 * reachable `TokenType` and every inline-special character in the
 * parser's dispatch table.
 *
 * @module fuzzer/generate
 */

/** Complexity tier — governs which block kinds and edge cases appear. */
export type Complexity = "simple" | "mixed" | "pathological";

/** Pseudo-random number source — threaded through generator helpers. */
export interface Rng {
  /** Next `[0,1)` float — mulberry32 state advance. */
  next(): number;
  /** Integer in `[0, maxExclusive)`. Returns 0 when `maxExclusive <= 0`. */
  int(maxExclusive: number): number;
  /** Pick a random element from a non-empty array. */
  pick<T>(arr: ReadonlyArray<T>): T;
  /** Biased coin — returns true with `probability` in `[0,1]` (default 0.5). */
  bool(probability?: number): boolean;
}

/**
 * Create a mulberry32-seeded RNG. Seed 0 is aliased to 1 to avoid the
 * degenerate zero state where all-zero seeds produce a repeating sequence.
 *
 * @param seed - Integer seed; non-integer values are coerced with `| 0`.
 * @returns A stateful RNG whose output is fully determined by `seed`.
 */
export function createRng(seed: number): Rng {
  let state = seed | 0 || 1;
  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (max) => (max <= 0 ? 0 : Math.floor(next() * max)),
    pick: <T>(arr: ReadonlyArray<T>) => arr[Math.floor(next() * arr.length)] as T,
    bool: (p = 0.5) => next() < p,
  };
}

/** Vocabulary pool for inline text — short, ASCII-only words that never trigger inline-special parsing. */
const WORDS: ReadonlyArray<string> = [
  "lorem",
  "ipsum",
  "dolor",
  "sit",
  "amet",
  "streamd",
  "parser",
  "token",
  "render",
  "stream",
  "block",
  "inline",
  "markdown",
  "chunk",
  "alpha",
  "beta",
  "gamma",
  "delta",
  "epsilon",
  "zeta",
];

/** Safe URL pool — every link/image URL is drawn from here to avoid XSS vectors in rendered output. */
const SAFE_URLS: ReadonlyArray<string> = [
  "https://example.com",
  "https://example.com/path",
  "http://example.org/doc",
  "mailto:ops@example.com",
  "tel:+15555550199",
  "#section",
];

/** Fenced-code language tags — includes empty string to exercise the no-info-string path. */
const LANGS: ReadonlyArray<string> = ["js", "ts", "py", "rs", "go", ""];

/** Block kinds the generator can emit; `kitchenSink` is the inline-variety paragraph. */
type BlockKind =
  | "heading"
  | "setextHeading"
  | "paragraph"
  | "kitchenSink"
  | "blockquote"
  | "unorderedList"
  | "orderedList"
  | "taskList"
  | "nestedList"
  | "fencedCode"
  | "indentedCode"
  | "htmlBlock"
  | "hr"
  | "table"
  | "mathBlock";

/** Full block roster for `mixed`/`pathological` — every block kind the parser can produce. */
const FULL_ROSTER: ReadonlyArray<BlockKind> = [
  "heading",
  "setextHeading",
  "paragraph",
  "kitchenSink",
  "blockquote",
  "unorderedList",
  "orderedList",
  "taskList",
  "nestedList",
  "fencedCode",
  "indentedCode",
  "htmlBlock",
  "hr",
  "table",
  "mathBlock",
];

/** Restricted roster for `simple` — excludes tables, math, and nested lists to keep output small. */
const SIMPLE_ROSTER: ReadonlyArray<BlockKind> = [
  "heading",
  "paragraph",
  "blockquote",
  "unorderedList",
  "orderedList",
  "fencedCode",
  "hr",
];

/**
 * Generate a deterministic markdown corpus.
 *
 * Output is structurally valid (see module docstring) and sized in the
 * 10 B – 50 KB range depending on complexity.
 *
 * @param seed - Integer seed; same seed + complexity produces same output.
 * @param complexity - Which roster / edge-case set to draw from.
 * @returns The generated markdown string.
 */
export function generate(seed: number, complexity: Complexity): string {
  const rng = createRng(seed || 1);
  const parts: Array<string> = [];
  if (complexity !== "simple") parts.push(coveragePreamble(rng));
  const extras = extraBlockCount(rng, complexity);
  for (let i = 0; i < extras; i++) parts.push(randomBlock(rng, complexity));
  return ensureMinSize(parts.join("\n"), rng, complexity);
}

/**
 * Upper bound on the number of random blocks appended after the
 * coverage preamble for each complexity tier.
 *
 * @param rng - Seeded RNG for deterministic count selection.
 * @param complexity - Tier controlling the range of block counts.
 * @returns Integer block count to generate.
 */
function extraBlockCount(rng: Rng, complexity: Complexity): number {
  if (complexity === "simple") return 1 + rng.int(4);
  if (complexity === "mixed") return 3 + rng.int(12);
  return 10 + rng.int(30);
}

/**
 * Pad short outputs to the 10-byte floor without changing structure.
 *
 * @param src - Current generated markdown.
 * @param rng - Seeded RNG for paragraph generation.
 * @param complexity - Tier passed to the paragraph generator.
 * @returns The original string if already >= 10 bytes, otherwise padded.
 */
function ensureMinSize(src: string, rng: Rng, complexity: Complexity): string {
  if (src.length >= 10) return src;
  return `${src}\n\n${genParagraph(rng, complexity)}\n`;
}

/**
 * Deterministic block sequence that, emitted once per corpus, guarantees
 * every reachable `TokenType` fires at least once on a GFM + math parse.
 * Each sub-generator ends with a trailing blank line so blocks cannot
 * inadvertently merge with following content.
 */
function coveragePreamble(rng: Rng): string {
  const blocks = [
    genHeading(rng, 1),
    genSetextHeading(rng),
    genKitchenSinkParagraph(rng),
    genBlockquote(rng),
    genUnorderedList(rng, false),
    genOrderedList(rng),
    genTaskList(rng),
    genNestedList(rng),
    genFencedCode(rng),
    genIndentedCode(rng),
    genHtmlBlock(rng),
    genHr(),
    genTable(rng),
    genMathBlock(rng),
    genEntityAndEscapeParagraph(rng),
  ];
  return blocks.join("\n");
}

/**
 * Dispatch from a `BlockKind` to its concrete generator.
 *
 * @param kind - Which block type to emit.
 * @param rng - Seeded RNG threaded to the generator.
 * @param complexity - Tier controlling edge-case density.
 * @returns Markdown string for one block (trailing newline included).
 */
function genBlock(kind: BlockKind, rng: Rng, complexity: Complexity): string {
  const generator = BLOCK_GENERATORS[kind];
  return generator(rng, complexity);
}

/**
 * Lookup table mapping each `BlockKind` to a generator function — defined
 * at module scope so dispatch stays monomorphic and JIT-friendly.
 */
const BLOCK_GENERATORS: Record<BlockKind, (rng: Rng, complexity: Complexity) => string> = {
  heading: (rng) => genHeading(rng, 1 + rng.int(6)),
  setextHeading: (rng) => genSetextHeading(rng),
  paragraph: (rng, complexity) => genParagraph(rng, complexity),
  kitchenSink: (rng) => genKitchenSinkParagraph(rng),
  blockquote: (rng) => genBlockquote(rng),
  unorderedList: (rng, complexity) => genUnorderedList(rng, complexity === "pathological"),
  orderedList: (rng) => genOrderedList(rng),
  taskList: (rng) => genTaskList(rng),
  nestedList: (rng) => genNestedList(rng),
  fencedCode: (rng) => genFencedCode(rng),
  indentedCode: (rng) => genIndentedCode(rng),
  htmlBlock: (rng) => genHtmlBlock(rng),
  hr: () => genHr(),
  table: (rng) => genTable(rng),
  mathBlock: (rng) => genMathBlock(rng),
};

/**
 * Pick a random block kind from the appropriate roster and generate it.
 *
 * @param rng - Seeded RNG for kind selection and content generation.
 * @param complexity - Tier controlling which roster to draw from.
 * @returns Markdown string for one randomly-chosen block.
 */
function randomBlock(rng: Rng, complexity: Complexity): string {
  const roster = complexity === "simple" ? SIMPLE_ROSTER : FULL_ROSTER;
  return genBlock(rng.pick(roster), rng, complexity);
}

/**
 * ATX heading `# ...` through `###### ...`, always followed by a blank line.
 *
 * @param rng - Seeded RNG for word generation.
 * @param level - Heading level (1–6); clamped internally.
 * @returns Markdown heading string with trailing newline.
 */
function genHeading(rng: Rng, level: number): string {
  const hashes = "#".repeat(Math.max(1, Math.min(6, level)));
  return `${hashes} ${genWords(rng, 2 + rng.int(5))}\n`;
}

/**
 * Setext heading: paragraph followed by `===` (level 1) or `---` (level 2).
 *
 * @param rng - Seeded RNG for text and underline selection.
 * @returns Markdown setext heading with trailing newline.
 */
function genSetextHeading(rng: Rng): string {
  const text = genWords(rng, 2 + rng.int(4));
  const underline = rng.bool() ? "===" : "---";
  return `${text}\n${underline}\n`;
}

/**
 * Plain paragraph with 1–4 lines. Each line may end with a soft newline.
 *
 * @param rng - Seeded RNG for line count and inline content.
 * @param complexity - Tier controlling line count and inline density.
 * @returns Markdown paragraph with trailing newline.
 */
function genParagraph(rng: Rng, complexity: Complexity): string {
  const lineCount = 1 + rng.int(complexity === "pathological" ? 4 : 2);
  const lines: Array<string> = [];
  for (let i = 0; i < lineCount; i++) lines.push(genInlineRun(rng, complexity));
  return `${lines.join("\n")}\n`;
}

/**
 * Paragraph that packs every inline token type into a single block so that
 * a single generation guarantees inline-token coverage.
 */
function genKitchenSinkParagraph(rng: Rng): string {
  const escapedPunct = rng.bool() ? "\\*" : "\\_";
  const hardbreak = "two  \n";
  const link = `[${genWords(rng, 1)}](${rng.pick(SAFE_URLS)})`;
  const image = `![alt](${rng.pick(SAFE_URLS)})`;
  const parts = [
    `**strong** and *em* and ~~strike~~ and \`code\` and ${link} and ${image}`,
    `with entity &amp; and ${escapedPunct} and <span>inline-html</span> and $x+1$`,
    `${hardbreak}after-hardbreak and soft\nbreak line`,
  ];
  return `${parts.join("\n")}\n`;
}

/**
 * A paragraph with entity references and escape characters — extra density.
 *
 * @param rng - Seeded RNG for entity and escape selection.
 * @returns Markdown paragraph containing at least one entity and one escape.
 */
function genEntityAndEscapeParagraph(rng: Rng): string {
  const entity = rng.pick(["&amp;", "&#65;", "&#x41;", "&copy;"]);
  const escapedPunct = rng.pick(["\\*", "\\_", "\\`", "\\[", "\\\\"]);
  return `plain ${entity} and ${escapedPunct} here.\n`;
}

/**
 * Multi-line blockquote; possibly containing inline emphasis.
 *
 * @param rng - Seeded RNG for line count and inline content.
 * @returns Markdown blockquote with trailing newline.
 */
function genBlockquote(rng: Rng): string {
  const lineCount = 1 + rng.int(3);
  const lines: Array<string> = [];
  for (let i = 0; i < lineCount; i++) lines.push(`> ${genInlineRun(rng, "mixed")}`);
  return `${lines.join("\n")}\n`;
}

/**
 * Unordered list (2–5 items); when `loose` is true, blank lines separate items.
 *
 * @param rng - Seeded RNG for item count, marker, and content.
 * @param loose - Whether to insert blank lines between items.
 * @returns Markdown unordered list with trailing newline.
 */
function genUnorderedList(rng: Rng, loose: boolean): string {
  const items = 2 + rng.int(4);
  const marker = rng.pick(["-", "+", "*"]);
  const sep = loose ? "\n\n" : "\n";
  const lines: Array<string> = [];
  for (let i = 0; i < items; i++) lines.push(`${marker} ${genWords(rng, 2 + rng.int(4))}`);
  return `${lines.join(sep)}\n`;
}

/**
 * Ordered list (2–5 items). Starts at a small positive integer.
 *
 * @param rng - Seeded RNG for item count, start number, and content.
 * @returns Markdown ordered list with trailing newline.
 */
function genOrderedList(rng: Rng): string {
  const items = 2 + rng.int(4);
  const start = 1 + rng.int(9);
  const lines: Array<string> = [];
  for (let i = 0; i < items; i++) lines.push(`${start + i}. ${genWords(rng, 2 + rng.int(3))}`);
  return `${lines.join("\n")}\n`;
}

/**
 * GFM task list — always includes one checked and one unchecked item.
 *
 * @param rng - Seeded RNG for item text.
 * @returns Markdown task list with trailing newline.
 */
function genTaskList(rng: Rng): string {
  const a = `- [x] done ${genWords(rng, 2)}`;
  const b = `- [ ] todo ${genWords(rng, 2)}`;
  return `${a}\n${b}\n`;
}

/**
 * Two-level nested list exercising ListItem children that contain a List.
 *
 * @param rng - Seeded RNG for item text.
 * @returns Markdown nested list with trailing newline.
 */
function genNestedList(rng: Rng): string {
  const outer = genWords(rng, 2);
  const inner1 = genWords(rng, 2);
  const inner2 = genWords(rng, 2);
  return `- ${outer}\n  - ${inner1}\n  - ${inner2}\n`;
}

/**
 * Fenced code block; info string randomly chosen; content is 1–3 lines.
 *
 * @param rng - Seeded RNG for language tag and content lines.
 * @returns Markdown fenced code block with trailing newline.
 */
function genFencedCode(rng: Rng): string {
  const lang = rng.pick(LANGS);
  const lineCount = 1 + rng.int(3);
  const lines: Array<string> = [];
  for (let i = 0; i < lineCount; i++) lines.push(`const x${i} = ${rng.int(100)};`);
  return `\`\`\`${lang}\n${lines.join("\n")}\n\`\`\`\n`;
}

/**
 * Indented code block — 4-space indent on each line.
 *
 * @param rng - Seeded RNG for function name variation.
 * @returns Markdown indented code block with trailing newline.
 */
function genIndentedCode(rng: Rng): string {
  const lines = [`    function f${rng.int(10)}() {`, "        return 1;", "    }"];
  return `${lines.join("\n")}\n`;
}

/**
 * Well-formed HTML block (type 6) — open/close tag pair with plain inner text.
 *
 * @param rng - Seeded RNG for tag name selection.
 * @returns Markdown HTML block with trailing newline.
 */
function genHtmlBlock(rng: Rng): string {
  const tag = rng.pick(["div", "section", "article"]);
  return `<${tag}>\n  hello\n</${tag}>\n`;
}

/**
 * Thematic break; chooses one of three valid forms.
 *
 * @returns Markdown thematic break (`---`) with trailing newline.
 */
function genHr(): string {
  return "---\n";
}

/**
 * GFM table with 2–4 columns and 1–3 body rows. Uses alignment specifiers.
 *
 * @param rng - Seeded RNG for column/row counts and cell content.
 * @returns Markdown GFM table with trailing newline.
 */
function genTable(rng: Rng): string {
  const cols = 2 + rng.int(3);
  const rows = 1 + rng.int(3);
  const header = buildTableRow(rng, cols, "h");
  const sep = buildTableSeparator(rng, cols);
  const body: Array<string> = [];
  for (let r = 0; r < rows; r++) body.push(buildTableRow(rng, cols, `r${r}`));
  return `${header}\n${sep}\n${body.join("\n")}\n`;
}

/**
 * Build a single table row like `| cell | cell |`.
 *
 * @param rng - Seeded RNG for cell word selection.
 * @param cols - Number of columns.
 * @param prefix - String prefix for each cell (e.g. "h" for header, "r0" for row 0).
 * @returns Pipe-delimited table row string.
 */
function buildTableRow(rng: Rng, cols: number, prefix: string): string {
  const cells: Array<string> = [];
  for (let c = 0; c < cols; c++) cells.push(`${prefix}${c}-${rng.pick(WORDS)}`);
  return `| ${cells.join(" | ")} |`;
}

/**
 * Build a GFM table separator row with randomized alignment.
 *
 * @param rng - Seeded RNG for alignment specifier selection.
 * @param cols - Number of columns.
 * @returns Pipe-delimited separator row string.
 */
function buildTableSeparator(rng: Rng, cols: number): string {
  const specs: Array<string> = [];
  for (let c = 0; c < cols; c++) specs.push(rng.pick([":---", ":---:", "---:", "---"]));
  return `| ${specs.join(" | ")} |`;
}

/**
 * Fenced display-math block — `$$` delimited, simple TeX-ish content.
 *
 * @param rng - Seeded RNG for variable subscript indices.
 * @returns Markdown math block with trailing newline.
 */
function genMathBlock(rng: Rng): string {
  return `$$\na_${rng.int(10)} = b_${rng.int(10)} + 1\n$$\n`;
}

/**
 * Build an inline content run — mixes plain text with a random assortment
 * of emphasis, code, links, images, and entities depending on complexity.
 */
function genInlineRun(rng: Rng, complexity: Complexity): string {
  const atomCount = 3 + rng.int(complexity === "pathological" ? 10 : 5);
  const atoms: Array<string> = [];
  for (let i = 0; i < atomCount; i++) atoms.push(genInlineAtom(rng));
  const joined = atoms.join(" ");
  return complexity === "pathological" ? maybeAppendHardbreak(rng, joined) : joined;
}

/**
 * Optionally append a hard break marker (two trailing spaces).
 *
 * @param rng - Seeded RNG for the 25% coin flip.
 * @param text - Inline text to potentially extend.
 * @returns The original text, or text with two trailing spaces appended.
 */
function maybeAppendHardbreak(rng: Rng, text: string): string {
  return rng.bool(0.25) ? `${text}  ` : text;
}

/**
 * Produce a single inline atom — word, emphasis, link, etc. Keeps the
 * per-call cyclomatic complexity bounded by dispatching through a table.
 */
function genInlineAtom(rng: Rng): string {
  const recipes: ReadonlyArray<(rng: Rng) => string> = [
    (r) => r.pick(WORDS),
    (r) => `*${r.pick(WORDS)}*`,
    (r) => `**${r.pick(WORDS)}**`,
    (r) => `\`${r.pick(WORDS)}\``,
    (r) => `[${r.pick(WORDS)}](${r.pick(SAFE_URLS)})`,
    (r) => `~~${r.pick(WORDS)}~~`,
    (r) => `![${r.pick(WORDS)}](${r.pick(SAFE_URLS)})`,
  ];
  return rng.pick(recipes)(rng);
}

/**
 * Join `count` random words with spaces.
 *
 * @param rng - Seeded RNG for word selection.
 * @param count - Number of words to join.
 * @returns Space-separated string of random words.
 */
function genWords(rng: Rng, count: number): string {
  const out: Array<string> = [];
  for (let i = 0; i < count; i++) out.push(rng.pick(WORDS));
  return out.join(" ");
}
