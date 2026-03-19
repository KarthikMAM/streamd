/**
 * Character code constants, char class flags, and the CHAR_TABLE lookup.
 *
 * CHAR_TABLE is a Uint8Array(128) for fast indexed access across V8, JSC,
 * and Hermes. All CC_* constants are plain numeric literals for predictable
 * JIT inlining.
 *
 * @module scanner/constants
 */

export const CC_TAB = 0x09;
export const CC_LF = 0x0a;
export const CC_CR = 0x0d;
export const CC_SPACE = 0x20;
export const CC_BANG = 0x21;
export const CC_DQUOTE = 0x22;
export const CC_HASH = 0x23;
export const CC_DOLLAR = 0x24;
export const CC_AMP = 0x26;
export const CC_SQUOTE = 0x27;
export const CC_LPAREN = 0x28;
export const CC_RPAREN = 0x29;
export const CC_STAR = 0x2a;
export const CC_PLUS = 0x2b;
export const CC_DASH = 0x2d;
export const CC_DOT = 0x2e;
export const CC_SLASH = 0x2f;
export const CC_0 = 0x30;
export const CC_9 = 0x39;
export const CC_COLON = 0x3a;
export const CC_SEMI = 0x3b;
export const CC_LT = 0x3c;
export const CC_EQ = 0x3d;
export const CC_GT = 0x3e;
export const CC_QMARK = 0x3f;
export const CC_AT = 0x40;
export const CC_A_UPPER = 0x41;
export const CC_Z_UPPER = 0x5a;
export const CC_LBRACKET = 0x5b;
export const CC_BACKSLASH = 0x5c;
export const CC_RBRACKET = 0x5d;
export const CC_UNDERSCORE = 0x5f;
export const CC_BACKTICK = 0x60;
export const CC_A_LOWER = 0x61;
export const CC_F_LOWER = 0x66;
export const CC_H_LOWER = 0x68;
export const CC_P_LOWER = 0x70;
export const CC_S_LOWER = 0x73;
export const CC_T_LOWER = 0x74;
export const CC_W_LOWER = 0x77;
export const CC_X_LOWER = 0x78;
export const CC_Z_LOWER = 0x7a;
export const CC_LBRACE = 0x7b;
export const CC_PIPE = 0x7c;
export const CC_RBRACE = 0x7d;
export const CC_TILDE = 0x7e;

export const CC_REPLACEMENT = 0xfffd;
export const CC_MAX_CODEPOINT = 0x10ffff;

export const CC_C_UPPER = 0x43;
export const CC_D_UPPER = 0x44;
export const CC_F_UPPER = 0x46;
export const CC_H_UPPER = 0x48;
export const CC_P_UPPER = 0x50;
export const CC_S_UPPER = 0x53;
export const CC_T_UPPER = 0x54;
export const CC_W_UPPER = 0x57;
export const CC_X_UPPER = 0x58;

export const CC_CARET = 0x5e;

export const CF_WHITESPACE = 1;
export const CF_PUNCTUATION = 2;
export const CF_SPECIAL = 4;

/**
 * Build the 128-entry character classification table.
 *
 * Each entry is a bitmask of CF_WHITESPACE, CF_PUNCTUATION, CF_SPECIAL.
 * Called once at module load — the result is a singleton.
 */
function buildCharTable(): Uint8Array {
  const t = new Uint8Array(128);

  // Whitespace: space, tab, LF, CR
  t[CC_SPACE] = CF_WHITESPACE;
  t[CC_TAB] = CF_WHITESPACE;
  t[CC_LF] = CF_WHITESPACE;
  t[CC_CR] = CF_WHITESPACE;

  // ASCII punctuation per CommonMark spec §2.1
  const punct = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";
  for (let i = 0; i < punct.length; i++) {
    t[punct.charCodeAt(i)] |= CF_PUNCTUATION;
  }

  // Special markdown characters — inline dispatch triggers
  const special = "\\`*_~[]!&<>\n$";
  for (let i = 0; i < special.length; i++) {
    t[special.charCodeAt(i)] |= CF_SPECIAL;
  }

  return t;
}

/**
 * Singleton 128-entry lookup table mapping ASCII codes to bitmask flags.
 *
 * Typed array indexed access is optimized across all JS engines.
 */
export const CHAR_TABLE: Uint8Array = buildCharTable();

/**
 * Known block-level HTML tag names for type 6 detection (spec §4.6).
 * Singleton Set — created once at module load.
 */
export const HTML_BLOCK_TAGS: ReadonlySet<string> = new Set([
  "address",
  "article",
  "aside",
  "base",
  "basefont",
  "blockquote",
  "body",
  "caption",
  "center",
  "col",
  "colgroup",
  "dd",
  "details",
  "dialog",
  "dir",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "frame",
  "frameset",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hr",
  "html",
  "iframe",
  "legend",
  "li",
  "link",
  "main",
  "menu",
  "menuitem",
  "nav",
  "noframes",
  "ol",
  "optgroup",
  "option",
  "p",
  "param",
  "search",
  "section",
  "summary",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "title",
  "tr",
  "track",
  "ul",
]);

/**
 * Type 1 HTML block tag names — `<pre>`, `<script>`, `<style>`, `<textarea>`.
 * These have specific close conditions (spec §4.6 type 1).
 */
export const HTML_TYPE1_TAGS: ReadonlySet<string> = new Set(["pre", "script", "style", "textarea"]);
