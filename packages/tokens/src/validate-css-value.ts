/**
 * Safety predicates for theme-derived CSS values.
 *
 * `themeToCss` emits theme values verbatim into a CSS rule block that is
 * later injected into a `<style>` tag via `dangerouslySetInnerHTML`.
 * An unvalidated string value such as
 * `"red; } body { display: none; } .foo {"` can close the current rule
 * block and inject arbitrary CSS — not XSS, but defacement / UI-redress.
 *
 * Every predicate here runs over the raw string/number before it is
 * interpolated into the CSS template. Callers throw at the trust
 * boundary on a `false` return value — the predicates themselves never
 * throw.
 *
 * @module validate-css-value
 */

/**
 * CSS-structural sequences that must never appear inside a theme colour.
 *
 * If any of these occur in a colour string, the value could close the
 * current rule block, open a new one, start a comment, or begin an HTML
 * tag after being rendered into an SSR `<style>` element.
 */
const COLOR_FORBIDDEN_SEQUENCES: ReadonlyArray<string> = [
  ";",
  "\n",
  "\r",
  "{",
  "}",
  "/*",
  "*/",
  "<",
];

/**
 * CSS-structural sequences that must never appear inside a font family.
 *
 * Matched quotes are permitted (family names like `"Helvetica Neue"`)
 * so quotes are checked separately by `hasMatchedQuotes`.
 */
const FONT_FAMILY_FORBIDDEN_SEQUENCES: ReadonlyArray<string> = [";", "\n", "\r", "{", "}"];

/** Hex colour body lengths permitted: `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`. */
const HEX_COLOR_LENGTHS: ReadonlySet<number> = new Set<number>([3, 4, 6, 8]);

/**
 * Colour-function names accepted at the start of a value.
 *
 * Every entry is the identifier preceding `(` in syntax like
 * `rgb(255 0 0)` or `color(display-p3 1 0 0)`. The closing `)` is
 * required at the very end of the string.
 */
const CSS_COLOR_FUNCTION_NAMES: ReadonlySet<string> = new Set<string>([
  "rgb",
  "rgba",
  "hsl",
  "hsla",
  "hwb",
  "lab",
  "lch",
  "oklab",
  "oklch",
  "color",
]);

/**
 * Named colour keywords from CSS Color Module Level 4.
 *
 * Lowercase only — callers must lowercase the input before lookup.
 * `transparent` and `currentcolor` are handled separately by
 * `isTransparentKeyword` (strictly they are "named-color" and
 * "currentcolor" tokens in the spec, not color keywords, but treating
 * them uniformly simplifies the predicate).
 */
const CSS_COLOR_KEYWORDS: ReadonlySet<string> = new Set<string>([
  "aliceblue",
  "antiquewhite",
  "aqua",
  "aquamarine",
  "azure",
  "beige",
  "bisque",
  "black",
  "blanchedalmond",
  "blue",
  "blueviolet",
  "brown",
  "burlywood",
  "cadetblue",
  "chartreuse",
  "chocolate",
  "coral",
  "cornflowerblue",
  "cornsilk",
  "crimson",
  "cyan",
  "darkblue",
  "darkcyan",
  "darkgoldenrod",
  "darkgray",
  "darkgreen",
  "darkgrey",
  "darkkhaki",
  "darkmagenta",
  "darkolivegreen",
  "darkorange",
  "darkorchid",
  "darkred",
  "darksalmon",
  "darkseagreen",
  "darkslateblue",
  "darkslategray",
  "darkslategrey",
  "darkturquoise",
  "darkviolet",
  "deeppink",
  "deepskyblue",
  "dimgray",
  "dimgrey",
  "dodgerblue",
  "firebrick",
  "floralwhite",
  "forestgreen",
  "fuchsia",
  "gainsboro",
  "ghostwhite",
  "gold",
  "goldenrod",
  "gray",
  "green",
  "greenyellow",
  "grey",
  "honeydew",
  "hotpink",
  "indianred",
  "indigo",
  "ivory",
  "khaki",
  "lavender",
  "lavenderblush",
  "lawngreen",
  "lemonchiffon",
  "lightblue",
  "lightcoral",
  "lightcyan",
  "lightgoldenrodyellow",
  "lightgray",
  "lightgreen",
  "lightgrey",
  "lightpink",
  "lightsalmon",
  "lightseagreen",
  "lightskyblue",
  "lightslategray",
  "lightslategrey",
  "lightsteelblue",
  "lightyellow",
  "lime",
  "limegreen",
  "linen",
  "magenta",
  "maroon",
  "mediumaquamarine",
  "mediumblue",
  "mediumorchid",
  "mediumpurple",
  "mediumseagreen",
  "mediumslateblue",
  "mediumspringgreen",
  "mediumturquoise",
  "mediumvioletred",
  "midnightblue",
  "mintcream",
  "mistyrose",
  "moccasin",
  "navajowhite",
  "navy",
  "oldlace",
  "olive",
  "olivedrab",
  "orange",
  "orangered",
  "orchid",
  "palegoldenrod",
  "palegreen",
  "paleturquoise",
  "palevioletred",
  "papayawhip",
  "peachpuff",
  "peru",
  "pink",
  "plum",
  "powderblue",
  "purple",
  "rebeccapurple",
  "red",
  "rosybrown",
  "royalblue",
  "saddlebrown",
  "salmon",
  "sandybrown",
  "seagreen",
  "seashell",
  "sienna",
  "silver",
  "skyblue",
  "slateblue",
  "slategray",
  "slategrey",
  "snow",
  "springgreen",
  "steelblue",
  "tan",
  "teal",
  "thistle",
  "tomato",
  "turquoise",
  "violet",
  "wheat",
  "white",
  "whitesmoke",
  "yellow",
  "yellowgreen",
]);

/** Regex matching a plain unsigned decimal integer or decimal fraction. */
const NUMERIC_STRING_PATTERN = /^[0-9]+(\.[0-9]+)?$/;

/** ASCII char code for digit `0`. */
const CHAR_CODE_DIGIT_0 = 48;
/** ASCII char code for digit `9`. */
const CHAR_CODE_DIGIT_9 = 57;
/** ASCII char code for lowercase `a`. */
const CHAR_CODE_LOWER_A = 97;
/** ASCII char code for lowercase `f`. */
const CHAR_CODE_LOWER_F = 102;

/**
 * True when `value` contains any sequence from `forbidden`.
 *
 * @param value - Input string to scan. Empty string returns `false`.
 * @param forbidden - Non-empty array of substring needles.
 * @returns `true` on the first match, `false` if none match.
 */
function containsAnyForbidden(value: string, forbidden: ReadonlyArray<string>): boolean {
  for (const sequence of forbidden) {
    if (value.includes(sequence)) return true;
  }
  return false;
}

/**
 * True when `code` is an ASCII hex digit `0-9` or `a-f`.
 *
 * Callers must lowercase the character before looking up its code.
 *
 * @param code - ASCII char code in `[0, 127]`.
 * @returns `true` for `0-9` or `a-f`, `false` otherwise.
 */
function isHexDigit(code: number): boolean {
  const isArabicDigit = code >= CHAR_CODE_DIGIT_0 && code <= CHAR_CODE_DIGIT_9;
  const isLowerHexLetter = code >= CHAR_CODE_LOWER_A && code <= CHAR_CODE_LOWER_F;
  return isArabicDigit || isLowerHexLetter;
}

/**
 * True when `value` is a well-formed hex colour.
 *
 * @param value - Lowercased CSS colour string.
 * @returns `true` when `value` is `#` followed by 3, 4, 6, or 8 hex
 *   digits. `false` otherwise.
 */
function isHexColor(value: string): boolean {
  if (value.charAt(0) !== "#") return false;
  const body = value.slice(1);
  if (!HEX_COLOR_LENGTHS.has(body.length)) return false;
  for (let index = 0; index < body.length; index++) {
    if (!isHexDigit(body.charCodeAt(index))) return false;
  }
  return true;
}

/**
 * True when `value` is shaped like `name(...)` for a known colour function.
 *
 * Forbidden-sequence checks in the caller already rule out nested braces,
 * semicolons, and HTML-unsafe characters, so this function only has to
 * check the outer syntax.
 *
 * @param value - Lowercased CSS colour string.
 * @returns `true` when the prefix before `(` is a recognised colour
 *   function name and the string ends with `)`. `false` otherwise.
 */
function isColorFunction(value: string): boolean {
  const parenIndex = value.indexOf("(");
  if (parenIndex < 1) return false;
  if (!value.endsWith(")")) return false;
  const name = value.slice(0, parenIndex);
  return CSS_COLOR_FUNCTION_NAMES.has(name);
}

/**
 * True when `value` is `transparent` or `currentcolor`.
 *
 * @param value - Lowercased candidate keyword.
 * @returns `true` for either literal, `false` otherwise.
 */
function isTransparentKeyword(value: string): boolean {
  return value === "transparent" || value === "currentcolor";
}

/**
 * True when a lowercased colour string matches any accepted colour form:
 * transparent keyword, hex literal, colour function, or named keyword.
 *
 * Caller is responsible for running `containsAnyForbidden` before
 * invoking this — `matchesColorForm` assumes the string is already
 * free of CSS-structural characters.
 *
 * @param lower - Lowercased colour candidate.
 * @returns `true` on match, `false` otherwise.
 */
function matchesColorForm(lower: string): boolean {
  if (isTransparentKeyword(lower)) return true;
  if (isHexColor(lower)) return true;
  if (isColorFunction(lower)) return true;
  return CSS_COLOR_KEYWORDS.has(lower);
}

/**
 * Count the occurrences of a single character in a string.
 *
 * @param value - Input string.
 * @param char - Single-character needle to count.
 * @returns Non-negative integer count.
 */
function countChar(value: string, char: string): number {
  let count = 0;
  for (let index = 0; index < value.length; index++) {
    if (value.charAt(index) === char) count += 1;
  }
  return count;
}

/**
 * True when every `"` and `'` in `value` appears in a matched pair.
 *
 * Only checks parity — does not verify that a `"` pairs with another
 * `"` (never a `'`). For CSS font-family values, parity is the
 * structural property that matters: an odd count of either quote type
 * leaves a quoted string open, which could swallow subsequent CSS
 * content when concatenated.
 *
 * @param value - Input string.
 * @returns `true` when both `"` and `'` counts are even. `false`
 *   otherwise.
 */
function hasMatchedQuotes(value: string): boolean {
  const doubleQuoteEven = countChar(value, '"') % 2 === 0;
  const singleQuoteEven = countChar(value, "'") % 2 === 0;
  return doubleQuoteEven && singleQuoteEven;
}

/**
 * True when `value` is a safe CSS colour the renderer can emit verbatim.
 *
 * Accepts:
 * - `transparent`, `currentColor` (case-insensitive)
 * - Hex: `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`
 * - Colour functions: `rgb()/rgba()`, `hsl()/hsla()`, `hwb()`,
 *   `lab()`, `lch()`, `oklab()`, `oklch()`, `color()`
 * - Named colours: the CSS Color Module Level 4 keyword allowlist
 *
 * Rejects any value containing CSS-structural characters such as `;`,
 * `{`, `}`, newlines, `/* *\/`, or `<`.
 *
 * @param value - Candidate colour string.
 * @returns `true` when safe to emit, `false` otherwise.
 */
export function isSafeColor(value: string): boolean {
  if (value.length === 0) return false;
  if (containsAnyForbidden(value, COLOR_FORBIDDEN_SEQUENCES)) return false;
  const lower = value.toLowerCase();
  return matchesColorForm(lower);
}

/**
 * True when `value` is a finite, non-NaN number.
 *
 * Rejects `Infinity`, `-Infinity`, and `NaN`. Negative finite numbers
 * pass this check — callers that need non-negative semantics (spacing,
 * radii) should guard on `value >= 0` in addition to this predicate.
 *
 * @param value - Candidate numeric token.
 * @returns `true` when finite and not NaN, `false` otherwise.
 */
export function isSafeLength(value: number): boolean {
  return Number.isFinite(value);
}

/**
 * True when `value` is a safe CSS font-family string.
 *
 * Accepts family lists (commas), spaces, and quoted names. Rejects
 * values containing `;`, `\n`, `\r`, `{`, or `}`, and rejects values
 * with unmatched `"` or `'` counts.
 *
 * @param value - Candidate font-family string.
 * @returns `true` when safe to emit, `false` otherwise.
 */
export function isSafeFontFamily(value: string): boolean {
  if (value.length === 0) return false;
  if (containsAnyForbidden(value, FONT_FAMILY_FORBIDDEN_SEQUENCES)) return false;
  return hasMatchedQuotes(value);
}

/**
 * True when `value` is a plain unsigned decimal numeric string.
 *
 * Matches `/^[0-9]+(\.[0-9]+)?$/` — one or more digits optionally
 * followed by a single `.` and more digits. Intended as a defensive
 * second layer for font weight and line-height values that flow
 * through `String(number)` into the CSS template; rejects scientific
 * notation, leading `+`/`-`, and any non-digit characters.
 *
 * @param value - Candidate numeric string.
 * @returns `true` on a clean numeric match, `false` otherwise.
 */
export function isSafeNumericString(value: string): boolean {
  return NUMERIC_STRING_PATTERN.test(value);
}
