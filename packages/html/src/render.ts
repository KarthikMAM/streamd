/**
 * HTML renderer — converts a streamd token tree into HTML.
 *
 * Plugin-aware: if `plugins` is supplied, tokens are passed through
 * `applyPlugins` before rendering. Each token's optional `meta` field
 * (id, className, rel, target, attrs) is honoured against a strict
 * safety allowlist.
 *
 * # Component overrides
 *
 * Consumers pass `components: { code_block: fn, ... }` to replace the
 * default renderer for any token type. The override receives the typed
 * token and an `HtmlRenderContext` with escape helpers and a recursive
 * `render` callback.
 *
 * # `meta.attrs` safety allowlist
 *
 * Arbitrary attributes injected through `meta.attrs` are filtered by
 * {@link isSafeAttributeName}: event handlers (`on*`), unknown names,
 * and names containing tag-breakout characters are dropped.
 *
 * @module render
 */

import type {
  BlockquoteToken,
  CodeBlockToken,
  EmToken,
  HeadingToken,
  HighlightData,
  ImageToken,
  InlineToken,
  LinkToken,
  ListItemToken,
  ListToken,
  MathBlockToken,
  MathInlineToken,
  ParagraphToken,
  StrikethroughToken,
  StrongToken,
  TableToken,
  TextToken,
  ThemedSegment,
  Token,
  TokenMeta,
  TokensList,
} from "@streamd/parser";
import { applyPlugins, type Plugin } from "@streamd/plugins";
import { decodeEntities, escapeAttr, escapeHtml, normalizeUrl } from "./escape";
import { htmlErrorMessage } from "./messages";
import type { HtmlComponents, HtmlRenderContext, RenderHtmlOptions } from "./types";
import { assertTokenList, rejectDeprecatedOptions, StreamdHtmlArgumentError } from "./validation";

/**
 * ASCII space character code (0x20). Used for stripping trailing spaces
 * from text tokens that precede hard line breaks per CommonMark §6.7.
 */
const CC_SPACE = 32;

/**
 * Fully resolved renderer options passed to every internal render helper.
 * Produced once by {@link renderHtml} from caller-supplied options;
 * kept frozen-shaped for monomorphic access in the dispatch loops.
 */
interface ResolvedOptions {
  readonly omitCodeLanguageClass: boolean;
  readonly xhtml: boolean;
  readonly classPrefix: string;
  readonly hasClassPrefix: boolean;
  readonly wrapRoot: boolean;
  readonly taskListCheckboxes: "disabled" | "none";
  readonly math: "span-class" | "tex-delim" | "none";
  readonly voidClose: string;
  readonly components: HtmlComponents | undefined;
}

/**
 * Cache of pre-built ` class="<prefix>-<kind>"` attribute strings.
 * Keyed by `"prefix:kind"`. Grows monotonically.
 */
const ATTR_CACHE = new Map<string, string>();

/** Attribute names always safe to echo through `meta.attrs`. */
const SAFE_ATTR_ALLOWLIST: ReadonlySet<string> = new Set([
  "class",
  "id",
  "title",
  "alt",
  "lang",
  "dir",
  "role",
  "href",
  "src",
]);

/** Matches strictly-lowercase `data-*` and `aria-*` custom-attribute names. */
const SAFE_DATA_ARIA_RE = /^(?:data|aria)-[a-z][a-z0-9-]*$/;

/** Matches safe attribute-name character sets (no tag-breakout bytes). */
const SAFE_ATTR_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

/** Schemes that are always unsafe in `href` / `src` values from `meta.attrs`. */
const UNSAFE_URL_SCHEMES: ReadonlyArray<string> = ["javascript:", "vbscript:", "data:", "file:"];

/**
 * Exhaustiveness helper — throws on unknown token kinds.
 *
 * @param token - The token with an unrecognised `type` discriminator.
 * @param context - Name of the dispatch site for the error message.
 * @throws {StreamdHtmlArgumentError} Always — with kind `"unknown-token-type"`.
 */
function unreachableToken(token: Token, context: string): never {
  const kind = String(token.type);
  throw new StreamdHtmlArgumentError({
    kind: "unknown-token-type",
    caller: context,
    message: htmlErrorMessage.unknownTokenType(context, kind),
  });
}

/**
 * Predicate: is `name` safe to emit as an attribute key in HTML output?
 *
 * @param name - Raw attribute name from `token.meta.attrs`.
 * @returns `true` when the name is safe; `false` when it must be dropped.
 */
function isSafeAttributeName(name: string): boolean {
  if (typeof name !== "string" || name.length === 0) return false;
  if (!SAFE_ATTR_NAME_RE.test(name)) return false;

  const lower = name.toLowerCase();
  if (lower.startsWith("on")) return false;
  if (SAFE_ATTR_ALLOWLIST.has(lower)) return true;

  return SAFE_DATA_ARIA_RE.test(name);
}

/**
 * Sanitize a URL value coming from `meta.attrs.href` or `meta.attrs.src`.
 *
 * @param url - Raw URL string from `meta.attrs`.
 * @returns A normalized URL safe to splice into a quoted attribute value.
 */
function safeAttrUrl(url: string): string {
  if (typeof url !== "string") return "";

  const lowered = url.trim().toLowerCase();
  for (let i = 0; i < UNSAFE_URL_SCHEMES.length; i++) {
    if (lowered.startsWith(UNSAFE_URL_SCHEMES[i])) return "#";
  }

  return normalizeUrl(url);
}

/**
 * Returns a cached ` class="<prefix>-<kind>"` attribute string.
 *
 * @param opts - Resolved rendering options containing the class prefix.
 * @param kind - Element kind suffix appended to the prefix.
 * @returns The pre-built class attribute string, or empty string.
 */
function classAttrCached(opts: ResolvedOptions, kind: string): string {
  if (!opts.hasClassPrefix) return "";
  const key = `${opts.classPrefix}:${kind}`;
  const cached = ATTR_CACHE.get(key);
  if (cached !== undefined) return cached;
  const built = ` class="${escapeAttr(`${opts.classPrefix}-${kind}`)}"`;
  ATTR_CACHE.set(key, built);
  return built;
}

/**
 * Compose the full attribute string for a block or inline element.
 *
 * @param opts - Resolved rendering options.
 * @param kind - Element kind suffix (e.g. "p", "h1").
 * @param meta - Optional token metadata.
 * @param extraClass - Optional additional class name to merge.
 * @returns Attribute string fragment starting with a space, or empty string.
 */
function elementAttrs(
  opts: ResolvedOptions,
  kind: string,
  meta: TokenMeta | undefined,
  extraClass?: string,
): string {
  if (meta === undefined && !extraClass) return classAttrCached(opts, kind);

  const parts: Array<string> = [];
  const classes: Array<string> = [];

  if (opts.hasClassPrefix) classes.push(`${opts.classPrefix}-${kind}`);
  if (extraClass) classes.push(extraClass);
  if (meta?.className) classes.push(meta.className);

  if (classes.length > 0) parts.push(` class="${escapeAttr(classes.join(" "))}"`);
  if (meta?.id) parts.push(` id="${escapeAttr(meta.id)}"`);
  if (meta?.attrs) appendSafeMetaAttrs(meta.attrs, parts);

  return parts.join("");
}

/**
 * Append validated `meta.attrs` entries onto the outgoing attribute parts.
 *
 * @param attrs - Raw `meta.attrs` map from the token.
 * @param parts - Accumulator array of attribute fragments.
 */
function appendSafeMetaAttrs(attrs: Readonly<Record<string, string>>, parts: Array<string>): void {
  for (const key of Object.keys(attrs)) {
    if (key === "class" || key === "id") continue;
    if (!isSafeAttributeName(key)) continue;

    const rawValue = attrs[key];
    if (typeof rawValue !== "string") continue;

    const lowerKey = key.toLowerCase();
    const isUrlAttr = lowerKey === "href" || lowerKey === "src";
    const sanitizedValue = isUrlAttr ? safeAttrUrl(rawValue) : rawValue;
    parts.push(` ${key}="${escapeAttr(sanitizedValue)}"`);
  }
}

/**
 * Render a token tree to an HTML string.
 *
 * @param tokens - Block-level token list produced by `parse()`.
 * @param options - Optional rendering overrides.
 * @returns HTML string. Empty input yields an empty string.
 * @throws StreamdHtmlArgumentError when `tokens` is not an array or
 *   a deprecated option is passed.
 */
export function renderHtml(tokens: TokensList, options: RenderHtmlOptions = {}): string {
  assertTokenList(tokens, "renderHtml");
  rejectDeprecatedOptions(options, "renderHtml");

  const opts = resolveOptions(options);
  const effective =
    options.plugins && options.plugins.length > 0
      ? applyPlugins(tokens, options.plugins as ReadonlyArray<Plugin>).tokens
      : tokens;

  if (effective.length === 0) return opts.wrapRoot ? openRoot(opts) + closeRoot() : "";

  const out: Array<string> = opts.wrapRoot ? [openRoot(opts)] : [];
  renderBlocks(effective, opts, out);
  if (opts.wrapRoot) out.push(closeRoot());
  return out.join("");
}

/**
 * Normalizes user-supplied render options into a fully resolved config.
 *
 * @param o - User-supplied partial options from `renderHtml`.
 * @returns Fully resolved options with all defaults applied.
 */
function resolveOptions(o: RenderHtmlOptions): ResolvedOptions {
  const prefix = o.classPrefix ?? "";
  const xhtml = o.xhtml ?? true;
  return {
    omitCodeLanguageClass: o.omitCodeLanguageClass ?? false,
    xhtml,
    classPrefix: prefix,
    hasClassPrefix: prefix.length > 0,
    wrapRoot: o.wrapRoot === true && prefix.length > 0,
    taskListCheckboxes: o.taskListCheckboxes ?? "disabled",
    math: o.math ?? "span-class",
    voidClose: xhtml ? " />" : ">",
    components: o.components,
  };
}

/**
 * Builds an `HtmlRenderContext` for component overrides.
 *
 * @param opts - Resolved rendering options.
 * @returns Context object with escape helpers and recursive render.
 */
function buildContext(opts: ResolvedOptions): HtmlRenderContext {
  return {
    escapeHtml,
    escapeAttr,
    classPrefix: opts.classPrefix,
    render: (token: Token) => {
      const out: Array<string> = [];
      renderBlock(token, opts, out);
      return out.join("");
    },
  };
}

/**
 * Produces the opening `<div>` tag for the root wrapper element.
 *
 * @param opts - Resolved options containing the class prefix.
 * @returns Opening div tag string with the root class attribute.
 */
function openRoot(opts: ResolvedOptions): string {
  return `<div class="${escapeAttr(`${opts.classPrefix}-root`)}">\n`;
}

/**
 * Produces the closing `</div>` tag for the root wrapper element.
 *
 * @returns Closing div tag string with trailing newline.
 */
function closeRoot(): string {
  return "</div>\n";
}

/**
 * Renders a sequence of block-level tokens.
 *
 * @param tokens - Array of block-level tokens to render.
 * @param opts - Resolved rendering options.
 * @param out - Accumulator array for HTML string fragments.
 */
function renderBlocks(
  tokens: ReadonlyArray<Token>,
  opts: ResolvedOptions,
  out: Array<string>,
): void {
  for (let i = 0; i < tokens.length; i++) renderBlock(tokens[i], opts, out);
}

/**
 * Dispatches a single block-level token to its type-specific renderer.
 * Checks component overrides first; falls through to built-in rendering.
 *
 * @param token - The block-level token to render.
 * @param opts - Resolved rendering options.
 * @param out - Accumulator array for HTML string fragments.
 * @throws {StreamdHtmlArgumentError} Via `unreachableToken` if unknown.
 */
function renderBlock(token: Token, opts: ResolvedOptions, out: Array<string>): void {
  const override = opts.components?.[token.type];
  if (override) {
    out.push((override as (t: Token, ctx: HtmlRenderContext) => string)(token, buildContext(opts)));
    return;
  }
  switch (token.type) {
    case "blockquote":
      renderBlockquote(token, opts, out);
      return;
    case "list":
      renderList(token, opts, out);
      return;
    case "list_item":
      renderListItem(token, opts, false, out);
      return;
    case "heading":
      renderHeading(token, opts, out);
      return;
    case "paragraph":
      renderParagraph(token, opts, out);
      return;
    case "code_block":
      renderCodeBlock(token, opts, out);
      return;
    case "hr":
      out.push(`<hr${elementAttrs(opts, "hr", token.meta)}${opts.voidClose}\n`);
      return;
    case "space":
      return;
    case "table":
      renderTable(token, opts, out);
      return;
    case "math_block":
      renderMathBlock(token, opts, out);
      return;
    default:
      unreachableToken(token, "renderBlock");
  }
}

/**
 * Renders a blockquote token as `<blockquote>` with nested block children.
 *
 * @param token - The blockquote token containing child blocks.
 * @param opts - Resolved rendering options.
 * @param out - Accumulator array for HTML string fragments.
 */
function renderBlockquote(token: BlockquoteToken, opts: ResolvedOptions, out: Array<string>): void {
  out.push(`<blockquote${elementAttrs(opts, "blockquote", token.meta)}>\n`);
  renderBlocks(token.children, opts, out);
  out.push("</blockquote>\n");
}

/**
 * Renders an ordered or unordered list token.
 *
 * @param token - The list token containing list-item children.
 * @param opts - Resolved rendering options.
 * @param out - Accumulator array for HTML string fragments.
 */
function renderList(token: ListToken, opts: ResolvedOptions, out: Array<string>): void {
  const tag = token.ordered ? "ol" : "ul";

  out.push(`<${tag}${elementAttrs(opts, tag, token.meta)}`);
  if (token.ordered && token.start !== 1) out.push(` start="${token.start}"`);
  out.push(">\n");

  for (let i = 0; i < token.children.length; i++) {
    renderListItem(token.children[i], opts, token.tight, out);
  }

  out.push(`</${tag}>\n`);
}

/**
 * Renders a list item token as `<li>`.
 *
 * @param token - The list item token.
 * @param opts - Resolved rendering options.
 * @param tight - Whether the parent list is tight.
 * @param out - Accumulator array for HTML string fragments.
 */
function renderListItem(
  token: ListItemToken,
  opts: ResolvedOptions,
  tight: boolean,
  out: Array<string>,
): void {
  out.push(`<li${elementAttrs(opts, "li", token.meta)}>`);
  renderListItemBody(token, opts, tight, out);
  out.push("</li>\n");
}

/**
 * Renders the inner body of a list item.
 *
 * @param token - The list item token whose body to render.
 * @param opts - Resolved rendering options.
 * @param tight - Whether the parent list is tight.
 * @param out - Accumulator array for HTML string fragments.
 */
function renderListItemBody(
  token: ListItemToken,
  opts: ResolvedOptions,
  tight: boolean,
  out: Array<string>,
): void {
  if (token.checked !== null) out.push(renderTaskCheckbox(token.checked, opts));

  if (tight && token.children.length === 1) {
    const only = token.children[0];
    if (only.type === "paragraph") {
      renderInlines(only.children, opts, out);
      return;
    }
  }

  if (token.children.length === 0) return;
  if (tight && tryRenderTightChildren(token.children, opts, out)) return;

  out.push("\n");
  renderBlocks(token.children, opts, out);
}

/**
 * Attempts to render list-item children as tight paragraphs.
 *
 * @param children - The list item's child tokens.
 * @param opts - Resolved rendering options.
 * @param out - Accumulator array for HTML string fragments.
 * @returns True if tight rendering succeeded, false otherwise.
 */
function tryRenderTightChildren(
  children: ReadonlyArray<Token>,
  opts: ResolvedOptions,
  out: Array<string>,
): boolean {
  for (let i = 0; i < children.length; i++) {
    if (children[i].type !== "paragraph") return false;
  }
  for (let i = 0; i < children.length; i++) {
    if (i > 0) out.push("\n");
    renderInlines((children[i] as ParagraphToken).children, opts, out);
  }
  return true;
}

/**
 * Produces the HTML for a task-list checkbox.
 *
 * @param checked - Whether the checkbox is checked.
 * @param opts - Resolved rendering options.
 * @returns HTML string for the checkbox or text marker.
 */
function renderTaskCheckbox(checked: boolean, opts: ResolvedOptions): string {
  if (opts.taskListCheckboxes === "none") return checked ? "[x] " : "[ ] ";
  const checkedAttr = checked ? ' checked=""' : "";
  const ariaChecked = checked ? "true" : "false";
  return `<input${checkedAttr} disabled="" type="checkbox" role="checkbox" aria-checked="${ariaChecked}" aria-disabled="true"${opts.voidClose} `;
}

/**
 * Renders a heading token as `<h1>`–`<h6>`.
 *
 * @param token - The heading token.
 * @param opts - Resolved rendering options.
 * @param out - Accumulator array for HTML string fragments.
 */
function renderHeading(token: HeadingToken, opts: ResolvedOptions, out: Array<string>): void {
  const level = token.level;
  out.push(`<h${level}${elementAttrs(opts, `h${level}`, token.meta)}>`);
  renderInlines(token.children, opts, out);
  out.push(`</h${level}>\n`);
}

/**
 * Renders a paragraph token as `<p>`.
 *
 * @param token - The paragraph token.
 * @param opts - Resolved rendering options.
 * @param out - Accumulator array for HTML string fragments.
 */
function renderParagraph(token: ParagraphToken, opts: ResolvedOptions, out: Array<string>): void {
  out.push(`<p${elementAttrs(opts, "p", token.meta)}>`);
  renderInlines(token.children, opts, out);
  out.push("</p>\n");
}

/**
 * Renders a fenced code block. When `meta.highlight` is populated,
 * emits per-segment `<span>` elements with inline styles. Otherwise
 * emits plain escaped code.
 *
 * @param token - The code block token.
 * @param opts - Resolved rendering options.
 * @param out - Accumulator array for HTML string fragments.
 */
function renderCodeBlock(token: CodeBlockToken, opts: ResolvedOptions, out: Array<string>): void {
  const highlight = token.meta?.highlight;
  if (highlight !== undefined) {
    renderHighlightedCodeBlock(token, highlight, opts, out);
    return;
  }

  const hasLang = token.lang.length > 0;
  const langClass = hasLang && !opts.omitCodeLanguageClass ? `language-${token.lang}` : undefined;

  out.push(`<pre${elementAttrs(opts, "pre", token.meta)} tabindex="0"`);
  if (hasLang) {
    out.push(` role="region" aria-label="${escapeAttr(`${token.lang} code block`)}"`);
  }
  out.push("><code");
  if (langClass) out.push(` class="${escapeAttr(langClass)}"`);
  out.push(">");
  out.push(escapeHtml(token.content));
  out.push("</code></pre>\n");
}

/**
 * Renders a code block with structured highlight data as styled spans.
 *
 * @param token - The code block token.
 * @param highlight - Structured highlight data from plugin-shiki.
 * @param opts - Resolved rendering options.
 * @param out - Accumulator array for HTML string fragments.
 */
function renderHighlightedCodeBlock(
  token: CodeBlockToken,
  highlight: HighlightData,
  opts: ResolvedOptions,
  out: Array<string>,
): void {
  const lang = token.lang.length > 0 ? token.lang : highlight.lang;

  out.push(`<pre${elementAttrs(opts, "pre", token.meta, "streamd-code-block")}`);
  if (lang.length > 0) out.push(` data-lang="${escapeAttr(lang)}"`);
  out.push(` tabindex="0" role="region" aria-label="${escapeAttr("code example")}"><code>`);

  for (let lineIdx = 0; lineIdx < highlight.lines.length; lineIdx++) {
    if (lineIdx > 0) out.push("\n");
    const segments = highlight.lines[lineIdx];
    for (let segIdx = 0; segIdx < segments.length; segIdx++) {
      renderThemedSegment(segments[segIdx], out);
    }
  }

  out.push("</code></pre>\n");
}

/**
 * Renders a single themed segment as a `<span>` with inline styles.
 *
 * @param seg - The themed segment with text and style properties.
 * @param out - Accumulator array for HTML string fragments.
 */
function renderThemedSegment(seg: ThemedSegment, out: Array<string>): void {
  const styles: Array<string> = [];
  if (seg.color) styles.push(`color:${seg.color}`);
  if (seg.bold) styles.push("font-weight:bold");
  if (seg.italic) styles.push("font-style:italic");
  if (seg.underline) styles.push("text-decoration:underline");

  if (styles.length > 0) {
    out.push(`<span style="${escapeAttr(styles.join(";"))}">`);
    out.push(escapeHtml(seg.text));
    out.push("</span>");
  } else {
    out.push(escapeHtml(seg.text));
  }
}

/**
 * Renders a GFM table token.
 *
 * @param token - The table token.
 * @param opts - Resolved rendering options.
 * @param out - Accumulator array for HTML string fragments.
 */
function renderTable(token: TableToken, opts: ResolvedOptions, out: Array<string>): void {
  out.push(`<table${elementAttrs(opts, "table", token.meta)}>\n<thead>\n<tr>\n`);

  for (let c = 0; c < token.head.length; c++) {
    out.push(`<th scope="col"${alignStyle(token.align, c)}>`);
    renderInlines(token.head[c], opts, out);
    out.push("</th>\n");
  }

  out.push("</tr>\n</thead>\n");

  if (token.rows.length > 0) {
    out.push("<tbody>\n");
    for (let r = 0; r < token.rows.length; r++) {
      const row = token.rows[r];
      out.push("<tr>\n");
      for (let c = 0; c < row.length; c++) {
        out.push(`<td${alignStyle(token.align, c)}>`);
        renderInlines(row[c], opts, out);
        out.push("</td>\n");
      }
      out.push("</tr>\n");
    }
    out.push("</tbody>\n");
  }

  out.push("</table>\n");
}

/**
 * Returns the `align` attribute string for a table cell.
 *
 * @param align - Array of column alignments.
 * @param col - Zero-based column index.
 * @returns ` align="<value>"` string, or empty string.
 */
function alignStyle(align: ReadonlyArray<"left" | "center" | "right" | null>, col: number): string {
  const a = align[col];
  if (!a) return "";
  return ` align="${a}"`;
}

/**
 * Renders a display-math block.
 *
 * @param token - The math block token.
 * @param opts - Resolved rendering options.
 * @param out - Accumulator array for HTML string fragments.
 */
function renderMathBlock(token: MathBlockToken, opts: ResolvedOptions, out: Array<string>): void {
  if (opts.math === "none") return;
  if (opts.math === "tex-delim") {
    out.push(`$$\n${escapeHtml(token.content)}$$\n`);
    return;
  }
  out.push(
    `<pre${elementAttrs(opts, "math-block", token.meta)} role="math" aria-label="math block"><code class="language-math math-display">${escapeHtml(token.content)}</code></pre>\n`,
  );
}

/**
 * Type predicate: text token preceding a hardbreak (for trailing-space strip).
 *
 * @param token Current inline token.
 * @param next Following inline token.
 */
function isTextBeforeHardbreak(
  token: InlineToken,
  next: InlineToken | undefined,
): token is TextToken {
  const isText = token.type === "text";
  const nextIsHardbreak = next !== undefined && next.type === "hardbreak";
  return isText && nextIsHardbreak;
}

/**
 * Renders an array of inline tokens.
 *
 * @param tokens - Array of inline tokens to render.
 * @param opts - Resolved rendering options.
 * @param out - Accumulator array for HTML string fragments.
 */
function renderInlines(
  tokens: ReadonlyArray<InlineToken>,
  opts: ResolvedOptions,
  out: Array<string>,
): void {
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const next = tokens[i + 1];

    if (isTextBeforeHardbreak(token, next)) {
      renderTextStrippingTrailingSpaces(token, out);
      continue;
    }

    renderInline(token, opts, out);
  }
}

/**
 * Renders a text token with trailing spaces stripped (before hardbreaks).
 *
 * @param token - The text token.
 * @param out - Accumulator array for HTML string fragments.
 */
function renderTextStrippingTrailingSpaces(token: TextToken, out: Array<string>): void {
  let end = token.content.length;
  while (end > 0 && token.content.charCodeAt(end - 1) === CC_SPACE) end--;

  if (end === token.content.length) {
    out.push(escapeHtml(decodeEntities(token.content)));
    return;
  }

  out.push(escapeHtml(decodeEntities(token.content.slice(0, end))));
}

/**
 * Dispatches a single inline token to its type-specific renderer.
 *
 * @param token - The inline token to render.
 * @param opts - Resolved rendering options.
 * @param out - Accumulator array for HTML string fragments.
 */
function renderInline(token: InlineToken, opts: ResolvedOptions, out: Array<string>): void {
  const override = opts.components?.[token.type];
  if (override) {
    out.push(
      (override as (t: InlineToken, ctx: HtmlRenderContext) => string)(token, buildContext(opts)),
    );
    return;
  }
  switch (token.type) {
    case "text":
      out.push(escapeHtml(decodeEntities(token.content)));
      return;
    case "hardbreak":
      out.push(`<br${opts.voidClose}\n`);
      return;
    case "code_span":
      out.push(
        `<code${elementAttrs(opts, "code", token.meta)}>${escapeHtml(token.content)}</code>`,
      );
      return;
    case "em":
      renderEm(token, opts, out);
      return;
    case "strong":
      renderStrong(token, opts, out);
      return;
    case "strikethrough":
      renderStrikethrough(token, opts, out);
      return;
    case "link":
      renderLink(token, opts, out);
      return;
    case "image":
      renderImage(token, opts, out);
      return;
    case "escape":
      out.push(escapeHtml(token.content));
      return;
    case "math_inline":
      renderMathInline(token, opts, out);
      return;
    default:
      unreachableToken(token, "renderInline");
  }
}

/**
 * Renders an emphasis token as `<em>`.
 *
 * @param token - The emphasis token.
 * @param opts - Resolved rendering options.
 * @param out - Accumulator array for HTML string fragments.
 */
function renderEm(token: EmToken, opts: ResolvedOptions, out: Array<string>): void {
  out.push(`<em${elementAttrs(opts, "em", token.meta)}>`);
  renderInlines(token.children, opts, out);
  out.push("</em>");
}

/**
 * Renders a strong-emphasis token as `<strong>`.
 *
 * @param token - The strong token.
 * @param opts - Resolved rendering options.
 * @param out - Accumulator array for HTML string fragments.
 */
function renderStrong(token: StrongToken, opts: ResolvedOptions, out: Array<string>): void {
  out.push(`<strong${elementAttrs(opts, "strong", token.meta)}>`);
  renderInlines(token.children, opts, out);
  out.push("</strong>");
}

/**
 * Renders a strikethrough token as `<del>`.
 *
 * @param token - The strikethrough token.
 * @param opts - Resolved rendering options.
 * @param out - Accumulator array for HTML string fragments.
 */
function renderStrikethrough(
  token: StrikethroughToken,
  opts: ResolvedOptions,
  out: Array<string>,
): void {
  out.push(`<del${elementAttrs(opts, "del", token.meta)}>`);
  renderInlines(token.children, opts, out);
  out.push("</del>");
}

/**
 * Computes the effective `rel` value for a link token.
 *
 * @param meta - Link token metadata.
 * @returns The rel string to emit, or `undefined`.
 */
function computeLinkRel(meta: TokenMeta | undefined): string | undefined {
  const authorRel = meta?.rel;
  if (meta?.target !== "_blank") return authorRel;

  const existingTokens = new Set<string>();
  if (authorRel) {
    for (const token of authorRel.split(" ")) {
      if (token.length > 0) existingTokens.add(token);
    }
  }

  const hasNoopener = existingTokens.has("noopener");
  const hasNoreferrer = existingTokens.has("noreferrer");
  if (hasNoopener && hasNoreferrer) return authorRel;

  if (!hasNoopener) existingTokens.add("noopener");
  if (!hasNoreferrer) existingTokens.add("noreferrer");
  return Array.from(existingTokens).join(" ");
}

/**
 * Renders a link token as `<a>`.
 *
 * @param token - The link token.
 * @param opts - Resolved rendering options.
 * @param out - Accumulator array for HTML string fragments.
 */
function renderLink(token: LinkToken, opts: ResolvedOptions, out: Array<string>): void {
  out.push(`<a href="${escapeAttr(normalizeUrl(decodeEntities(token.href)))}"`);
  if (token.title.length > 0) out.push(` title="${escapeAttr(decodeEntities(token.title))}"`);

  const rel = computeLinkRel(token.meta);
  if (rel !== undefined && rel.length > 0) out.push(` rel="${escapeAttr(rel)}"`);
  if (token.meta?.target) out.push(` target="${escapeAttr(token.meta.target)}"`);

  out.push(elementAttrs(opts, "a", token.meta));
  out.push(">");
  renderInlines(token.children, opts, out);
  out.push("</a>");
}

/**
 * Renders an image token as `<img>`.
 *
 * @param token - The image token.
 * @param opts - Resolved rendering options.
 * @param out - Accumulator array for HTML string fragments.
 */
function renderImage(token: ImageToken, opts: ResolvedOptions, out: Array<string>): void {
  out.push(`<img src="${escapeAttr(normalizeUrl(decodeEntities(token.src)))}"`);
  out.push(` alt="${escapeAttr(decodeEntities(token.alt))}"`);
  if (token.title.length > 0) out.push(` title="${escapeAttr(decodeEntities(token.title))}"`);
  out.push(elementAttrs(opts, "img", token.meta));
  out.push(opts.voidClose);
}

/**
 * Renders an inline math token.
 *
 * @param token - The inline math token.
 * @param opts - Resolved rendering options.
 * @param out - Accumulator array for HTML string fragments.
 */
function renderMathInline(token: MathInlineToken, opts: ResolvedOptions, out: Array<string>): void {
  if (opts.math === "none") return;
  if (opts.math === "tex-delim") {
    out.push(`$${escapeHtml(token.content)}$`);
    return;
  }
  out.push(`<code class="language-math math-inline">${escapeHtml(token.content)}</code>`);
}
