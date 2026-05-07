/**
 * HTML renderer — converts a streamd token tree into HTML.
 *
 * Plugin-aware: if `plugins` is supplied, tokens are passed through
 * `applyPlugins` before rendering, and each token's optional `meta`
 * field (id, className, rel, target, attrs) is honoured against a
 * strict safety allowlist.
 *
 * # `meta.html` passthrough is opt-in
 *
 * Plugins may attach a pre-rendered HTML string to `token.meta.html`
 * (`@streamd/plugins`' `highlightCode` builtin does this for code
 * blocks). The renderer only splices that string into the output when
 * the caller explicitly passes `allowDangerousMetaHtml: true`. By
 * default the field is ignored and the token is rendered normally.
 *
 * `sanitize()` from `@streamd/plugins` does NOT walk `meta`; enabling
 * the flag trusts every plugin in the pipeline to produce safe HTML.
 * See `RenderHtmlOptions.allowDangerousMetaHtml` for the full contract.
 *
 * # `meta.attrs` safety allowlist
 *
 * Arbitrary attributes injected through `meta.attrs` are filtered by
 * {@link isSafeAttributeName}: event handlers (`on*`), unknown names,
 * and names containing tag-breakout characters are dropped. `href` and
 * `src` values are re-written through a scheme check + `normalizeUrl`
 * so an attacker-controlled plugin cannot emit a `javascript:` URL.
 *
 * # Performance
 *
 * All output is accumulated into a string `Array<string>` and joined
 * once at the end — this is substantially faster than repeated `+=`
 * in V8 because it avoids the `ConsString` flatten on every concat.
 * Attribute strings for the top-level class name are cached per
 * `classPrefix`.
 *
 * @module render
 */

import {
  type BlockquoteToken,
  type CodeBlockToken,
  type EmToken,
  type HeadingToken,
  type ImageToken,
  type InlineToken,
  type LinkToken,
  type ListItemToken,
  type ListToken,
  type MathBlockToken,
  type MathInlineToken,
  type ParagraphToken,
  type StrikethroughToken,
  type StrongToken,
  type TableToken,
  type TextToken,
  type Token,
  type TokenMeta,
  type TokensList,
  TokenType,
} from "@streamd/parser";
import { applyPlugins, type Plugin } from "@streamd/plugins";
import { decodeEntities, escapeAttr, escapeHtml, normalizeUrl } from "./escape";
import { htmlErrorMessage } from "./messages";
import type { RenderHtmlOptions } from "./types";
import { assertTokenList, StreamdHtmlArgumentError } from "./validation";

/**
 * ASCII space character code (0x20). Used for stripping trailing spaces
 * from text tokens that precede hard line breaks per CommonMark §6.7.
 */
const CC_SPACE = 32;

/**
 * Exhaustiveness helper for the renderer dispatch switches — throws on
 * unknown token kinds so a malformed token tree surfaces at the rendering
 * site instead of silently dropping content.
 *
 * Routes through `StreamdHtmlArgumentError` with `kind: "unknown-token-type"`
 * so consumers can write a single `instanceof StreamdArgumentError` catch
 * across every `@streamd/*` package rather than matching against an
 * anonymous `Error` subclass.
 *
 * The argument type is `Token` rather than `never` because the renderer's
 * block / inline dispatches narrow the union asymmetrically; the runtime
 * check is what matters.
 *
 * @param token - The token with an unrecognised `type` discriminator.
 * @param context - Name of the dispatch site (e.g. `"renderBlock"`) used
 *   in the error message to locate which switch failed exhaustiveness.
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
 * Fully resolved renderer options passed to every internal render helper.
 * Produced once by {@link renderHtml} from a caller-supplied `HtmlOptions`;
 * kept frozen-shaped for monomorphic access in the dispatch loops.
 */
interface ResolvedOptions {
  /** Whether to suppress the `language-*` class on fenced code blocks. */
  readonly omitCodeLanguageClass: boolean;
  /** Whether to emit XHTML-style void-element closing (`<br />`). */
  readonly xhtml: boolean;
  /** CSS class prefix applied to block-level tags (empty string = disabled). */
  readonly classPrefix: string;
  /** Pre-computed flag: true when `classPrefix` is non-empty. */
  readonly hasClassPrefix: boolean;
  /** Whether to wrap output in a `<div class="<prefix>-root">` container. */
  readonly wrapRoot: boolean;
  /** Task-list checkbox rendering mode: "disabled" emits `<input>`, "none" emits text. */
  readonly taskListCheckboxes: "disabled" | "none";
  /** Math rendering mode: "span-class" wraps in `<code>`, "tex-delim" uses `$`, "none" suppresses. */
  readonly math: "span-class" | "tex-delim" | "none";
  /** Pre-computed void-element closing string: `" />"` for XHTML, `">"` for HTML5. */
  readonly voidClose: string;
  /** Whether to honour `token.meta.html` passthrough from plugins. */
  readonly allowDangerousMetaHtml: boolean;
}

/**
 * Cache of pre-built ` class="<prefix>-<kind>"` attribute strings.
 *
 * Keyed by `"prefix:kind"`. Avoids repeated string concatenation and
 * `escapeAttr` calls for the same class attribute across render passes.
 * Grows monotonically — never cleared, since the set of (prefix, kind)
 * pairs is small and fixed per application.
 */
const ATTR_CACHE = new Map<string, string>();

/**
 * Attribute names always safe to echo through `meta.attrs` — every entry
 * is a presentational or accessibility attribute with no executable
 * side-effects. `class` and `id` are in the set so {@link isSafeAttributeName}
 * approves them, but the emission path still routes them through the
 * dedicated class / id branches in {@link elementAttrs} to avoid
 * double-emission.
 */
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

/**
 * Matches strictly-lowercase `data-*` and `aria-*` custom-attribute names.
 * First char after the prefix must be a letter; subsequent chars are
 * letters, digits, or hyphens. Mirrors the HTML spec requirement that
 * `data-*` / `aria-*` names be XML-compatible and lowercase in the
 * author-written source.
 */
const SAFE_DATA_ARIA_RE = /^(?:data|aria)-[a-z][a-z0-9-]*$/;

/**
 * Matches attribute-name character sets that cannot escape an opening tag:
 * ASCII letters, digits, hyphens, and underscores only. Anything outside
 * this set (`"`, `'`, `>`, `<`, `/`, whitespace, etc.) is rejected before
 * the allowlist check so we never emit a key containing tag-breakout bytes.
 */
const SAFE_ATTR_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

/**
 * Schemes that are always unsafe in `href` / `src` values when the
 * attribute originates from `meta.attrs`. A plugin-authored URL that uses
 * any of these schemes is rewritten to the `"#"` fallback before emission.
 */
const UNSAFE_URL_SCHEMES: ReadonlyArray<string> = ["javascript:", "vbscript:", "data:", "file:"];

/**
 * Predicate: is `name` safe to emit as an attribute key in HTML output?
 *
 * Rejects event-handler attributes (anything whose lower-cased name
 * starts with `on`), any name containing a tag-breakout character such
 * as `"`, `>`, or whitespace, and any name not on the presentational
 * allowlist or the `data-*` / `aria-*` pattern. Callers must still
 * route `class` and `id` through their dedicated emission paths even
 * though this predicate accepts them.
 *
 * @param name - Raw attribute name from `token.meta.attrs`. Any runtime
 *   type is tolerated; non-strings return `false`.
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
 * Rejects URLs whose leading scheme (whitespace-trimmed, case-insensitive)
 * matches any entry in {@link UNSAFE_URL_SCHEMES} and returns `"#"` in
 * their place — the same convention used by the `sanitize()` plugin.
 * Safe URLs are percent-encoded via {@link normalizeUrl} exactly as
 * built-in link/image rendering does.
 *
 * @param url - Raw URL string from `meta.attrs`. Non-string values are
 *   coerced to empty.
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
 * Looks up the cache by "prefix:kind" key. On miss, builds the attribute
 * string, stores it, and returns it. Returns empty string when no class
 * prefix is configured.
 *
 * @param opts - Resolved rendering options containing the class prefix.
 * @param kind - Element kind suffix appended to the prefix (e.g. "p", "h1").
 * @returns The pre-built class attribute string, or empty string if no prefix.
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
 * Render a token tree to an HTML string.
 *
 * Stable output for matching CommonMark / GFM reference fixtures
 * after minification (whitespace-tolerant comparison is recommended).
 *
 * @param tokens - Block-level token list produced by `parse()`. Must be
 *   an array — any other type throws `StreamdHtmlArgumentError`.
 * @param options - Optional rendering overrides. Pass `plugins` to apply
 *   token transforms (see `@streamd/plugins`).
 * @returns HTML string. Empty input yields an empty string.
 * @throws StreamdHtmlArgumentError when `tokens` is not an array.
 */
export function renderHtml(tokens: TokensList, options: RenderHtmlOptions = {}): string {
  assertTokenList(tokens, "renderHtml");

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
 * Applies defaults for every optional field so downstream renderers can
 * read properties without null checks.
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
    allowDangerousMetaHtml: o.allowDangerousMetaHtml ?? false,
  };
}

/**
 * Produces the opening `<div>` tag for the root wrapper element.
 *
 * @param opts - Resolved options containing the class prefix for the root class.
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
 * Compose the full attribute string for a block or inline element.
 *
 * Merges the class-prefix class, any extra class (e.g. language class on
 * code blocks), and meta-supplied `className`, `id`, and safe `attrs` into
 * a single attribute fragment ready to splice after the tag name.
 *
 * When no meta is present and no extra class is needed, delegates to the
 * cached fast path via {@link classAttrCached}.
 *
 * @param opts - Resolved rendering options containing the class prefix.
 * @param kind - Element kind suffix (e.g. "p", "h1", "blockquote").
 * @param meta - Optional token metadata carrying className, id, and attrs.
 * @param extraClass - Optional additional class name to merge (e.g. language class).
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
 * Every key is screened through {@link isSafeAttributeName}; `class` and
 * `id` are routed via their dedicated paths in {@link elementAttrs} and so
 * are skipped here to avoid double emission. `href` and `src` values run
 * through {@link safeAttrUrl} so attacker-controlled plugins cannot emit a
 * `javascript:` URL into the output tag. All accepted values are still
 * HTML-attribute-escaped by {@link escapeAttr} before concatenation.
 *
 * @param attrs - Raw `meta.attrs` map from the token. Treated as untrusted
 *   input regardless of the plugin that produced it.
 * @param parts - Accumulator array of attribute fragments being assembled
 *   by {@link elementAttrs}; this function only appends.
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
 * Renders a sequence of block-level tokens by dispatching each to `renderBlock`.
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
 *
 * If the token carries a `meta.html` override AND the caller opted in via
 * `allowDangerousMetaHtml: true`, that raw HTML is emitted directly without
 * further processing. When the flag is `false` (the default) `meta.html`
 * is ignored and the token is rendered normally — plugins that write
 * `meta.html` therefore get a predictable no-op unless the caller has
 * audited every plugin in the pipeline.
 *
 * @param token - The block-level token to render.
 * @param opts - Resolved rendering options (carries the opt-in flag).
 * @param out - Accumulator array for HTML string fragments.
 * @throws {StreamdHtmlArgumentError} Via `unreachableToken` if the token
 *   type is unknown.
 */
function renderBlock(token: Token, opts: ResolvedOptions, out: Array<string>): void {
  if (opts.allowDangerousMetaHtml && token.meta?.html !== undefined) {
    out.push(token.meta.html);
    return;
  }
  switch (token.type) {
    case TokenType.Blockquote:
      renderBlockquote(token, opts, out);
      return;
    case TokenType.List:
      renderList(token, opts, out);
      return;
    case TokenType.ListItem:
      renderListItem(token, opts, false, out);
      return;
    case TokenType.Heading:
      renderHeading(token, opts, out);
      return;
    case TokenType.Paragraph:
      renderParagraph(token, opts, out);
      return;
    case TokenType.CodeBlock:
      renderCodeBlock(token, opts, out);
      return;
    case TokenType.HtmlBlock:
      out.push(token.content);
      return;
    case TokenType.Hr:
      out.push(`<hr${elementAttrs(opts, "hr", token.meta)}${opts.voidClose}\n`);
      return;
    case TokenType.Space:
      return;
    case TokenType.Table:
      renderTable(token, opts, out);
      return;
    case TokenType.MathBlock:
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
 * Renders an ordered or unordered list token as `<ol>` or `<ul>`.
 *
 * Includes a `start` attribute for ordered lists that do not begin at 1.
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
 * Renders a list item token as `<li>` with its body content.
 *
 * @param token - The list item token.
 * @param opts - Resolved rendering options.
 * @param tight - Whether the parent list is tight (affects paragraph unwrapping).
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
 * Renders the inner body of a list item, handling task checkboxes and
 * tight-list paragraph unwrapping.
 *
 * In tight mode with a single paragraph child, the paragraph wrapper is
 * omitted and inlines are rendered directly.
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
    if (only.type === TokenType.Paragraph) {
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
 * Attempts to render list-item children as tight paragraphs (no `<p>` wrappers).
 *
 * Only valid for tight lists — CommonMark §5.2 requires loose lists to wrap
 * each item-paragraph in `<p>`. Callers MUST gate the invocation on
 * `tight === true`; this helper does not re-check the flag.
 *
 * Returns true if all children are paragraphs and were rendered inline;
 * returns false if any child is not a paragraph, leaving `out` unchanged.
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
    if (children[i].type !== TokenType.Paragraph) return false;
  }
  for (let i = 0; i < children.length; i++) {
    if (i > 0) out.push("\n");
    renderInlines((children[i] as ParagraphToken).children, opts, out);
  }
  return true;
}

/**
 * Produces the HTML for a task-list checkbox or text marker.
 *
 * When `taskListCheckboxes` is "none", returns a text bracket marker.
 * Otherwise returns a disabled `<input type="checkbox">` element annotated
 * with the ARIA attributes required by WAI-ARIA 1.2 §checkbox:
 * `role="checkbox"`, explicit `aria-checked="true|false"`, and
 * `aria-disabled="true"`. The explicit lowercase string values defend
 * against assistive-tech implementations that do not treat a boolean
 * `checked` attribute as the aria-checked source of truth.
 *
 * @param checked - Whether the checkbox is checked.
 * @param opts - Resolved rendering options controlling checkbox style.
 * @returns HTML string for the checkbox or text marker.
 */
function renderTaskCheckbox(checked: boolean, opts: ResolvedOptions): string {
  if (opts.taskListCheckboxes === "none") return checked ? "[x] " : "[ ] ";
  const checkedAttr = checked ? ' checked=""' : "";
  const ariaChecked = checked ? "true" : "false";
  return `<input${checkedAttr} disabled="" type="checkbox" role="checkbox" aria-checked="${ariaChecked}" aria-disabled="true"${opts.voidClose} `;
}

/**
 * Renders a heading token as `<h1>`–`<h6>` with inline children.
 *
 * @param token - The heading token with level and inline children.
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
 * Renders a paragraph token as `<p>` with inline children.
 *
 * @param token - The paragraph token containing inline children.
 * @param opts - Resolved rendering options.
 * @param out - Accumulator array for HTML string fragments.
 */
function renderParagraph(token: ParagraphToken, opts: ResolvedOptions, out: Array<string>): void {
  out.push(`<p${elementAttrs(opts, "p", token.meta)}>`);
  renderInlines(token.children, opts, out);
  out.push("</p>\n");
}

/**
 * Renders a fenced code block as `<pre><code>` with optional language class.
 *
 * The code content is HTML-escaped. A `language-{lang}` class is added to
 * the `<code>` element unless `omitCodeLanguageClass` is set or no language
 * is specified.
 *
 * @param token - The code block token with language and content.
 * @param opts - Resolved rendering options.
 * @param out - Accumulator array for HTML string fragments.
 */
function renderCodeBlock(token: CodeBlockToken, opts: ResolvedOptions, out: Array<string>): void {
  const hasLang = token.lang.length > 0;
  const langClass = hasLang && !opts.omitCodeLanguageClass ? `language-${token.lang}` : undefined;

  out.push(`<pre${elementAttrs(opts, "pre", token.meta)} tabindex="0"`);
  if (hasLang) {
    out.push(` role="region" aria-label="${escapeAttr(`${token.lang} code block`)}"`);
  }
  out.push(">");

  out.push("<code");
  if (langClass) out.push(` class="${escapeAttr(langClass)}"`);
  out.push(">");
  out.push(escapeHtml(token.content));
  out.push("</code></pre>\n");
}

/**
 * Renders a GFM table token as `<table>` with `<thead>` and optional `<tbody>`.
 *
 * Column alignment is applied via `align` attributes on `<th>` and `<td>`.
 *
 * @param token - The table token with head, rows, and alignment info.
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
 * Returns the `align` attribute string for a table cell at the given column.
 *
 * @param align - Array of column alignments (left, center, right, or null).
 * @param col - Zero-based column index.
 * @returns ` align="<value>"` string, or empty string if no alignment.
 */
function alignStyle(align: ReadonlyArray<"left" | "center" | "right" | null>, col: number): string {
  const a = align[col];
  if (!a) return "";
  return ` align="${a}"`;
}

/**
 * Renders a display-math block according to the configured math mode.
 *
 * In "none" mode, output is suppressed. In "tex-delim" mode, wraps content
 * in `$$` delimiters. In "span-class" mode, wraps in `<pre><code>` with
 * math-specific classes.
 *
 * @param token - The math block token with TeX content.
 * @param opts - Resolved rendering options controlling math output mode.
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
 * Type predicate: the current inline token is a `Text` whose successor is
 * a `Hardbreak`. Wrapping the two atomic facts (`token is Text`,
 * `next is Hardbreak`) in one named predicate keeps the caller readable
 * while still narrowing `token` to {@link TextToken} inside the branch.
 *
 * @param token Current inline token.
 * @param next Following inline token (undefined at end of list).
 */
function isTextBeforeHardbreak(
  token: InlineToken,
  next: InlineToken | undefined,
): token is TextToken {
  const isText = token.type === TokenType.Text;
  const hasNext = next !== undefined;
  const nextIsHardbreak = hasNext && next.type === TokenType.Hardbreak;
  return isText && nextIsHardbreak;
}

/**
 * Renders an array of inline tokens, applying special handling for
 * text tokens that precede hard line breaks (strips trailing spaces).
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
 * Renders a text token with trailing spaces stripped (used before hardbreaks).
 *
 * CommonMark specifies that trailing spaces before a hard line break are
 * not rendered. This function trims them before escaping and emitting.
 *
 * @param token - The text token whose content may have trailing spaces.
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
 * @throws Error via `unreachableToken` if the token type is unknown.
 */
function renderInline(token: InlineToken, opts: ResolvedOptions, out: Array<string>): void {
  switch (token.type) {
    case TokenType.Text:
      out.push(escapeHtml(decodeEntities(token.content)));
      return;
    case TokenType.Softbreak:
      out.push("\n");
      return;
    case TokenType.Hardbreak:
      out.push(`<br${opts.voidClose}\n`);
      return;
    case TokenType.CodeSpan:
      out.push(
        `<code${elementAttrs(opts, "code", token.meta)}>${escapeHtml(token.content)}</code>`,
      );
      return;
    case TokenType.Em:
      renderEm(token, opts, out);
      return;
    case TokenType.Strong:
      renderStrong(token, opts, out);
      return;
    case TokenType.Strikethrough:
      renderStrikethrough(token, opts, out);
      return;
    case TokenType.Link:
      renderLink(token, opts, out);
      return;
    case TokenType.Image:
      renderImage(token, opts, out);
      return;
    case TokenType.HtmlInline:
      out.push(token.content);
      return;
    case TokenType.Escape:
      out.push(escapeHtml(token.content));
      return;
    case TokenType.MathInline:
      renderMathInline(token, opts, out);
      return;
    default:
      unreachableToken(token, "renderInline");
  }
}

/**
 * Renders an emphasis token as `<em>` with inline children.
 *
 * @param token - The emphasis token containing inline children.
 * @param opts - Resolved rendering options.
 * @param out - Accumulator array for HTML string fragments.
 */
function renderEm(token: EmToken, opts: ResolvedOptions, out: Array<string>): void {
  out.push(`<em${elementAttrs(opts, "em", token.meta)}>`);
  renderInlines(token.children, opts, out);
  out.push("</em>");
}

/**
 * Renders a strong-emphasis token as `<strong>` with inline children.
 *
 * @param token - The strong token containing inline children.
 * @param opts - Resolved rendering options.
 * @param out - Accumulator array for HTML string fragments.
 */
function renderStrong(token: StrongToken, opts: ResolvedOptions, out: Array<string>): void {
  out.push(`<strong${elementAttrs(opts, "strong", token.meta)}>`);
  renderInlines(token.children, opts, out);
  out.push("</strong>");
}

/**
 * Renders a strikethrough token as `<del>` with inline children.
 *
 * @param token - The strikethrough token containing inline children.
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
 * Computes the effective `rel` value for a link token, enforcing the
 * `noopener noreferrer` guarantee when the link opens in a new tab.
 *
 * When `meta.target === "_blank"`, browsers expose the opener window
 * unless the link declares `rel="noopener"`, and leak the referring URL
 * unless it declares `rel="noreferrer"`. Adding both is the WAI-ARIA
 * Authoring Practices and OWASP recommendation.
 *
 * Idempotent: when `meta.rel` already lists `noopener` and `noreferrer`
 * the original string is returned unchanged; when it lists one, the
 * missing token is appended; when it lists neither, both are appended.
 * Author-supplied values are preserved and never duplicated.
 *
 * @param meta - Link token metadata (may be undefined). Only `target`
 *   and `rel` are inspected.
 * @returns The rel string to emit, or `undefined` when no rel should be
 *   added (not target=_blank and no author-supplied rel).
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
 * Renders a link token as `<a>` with href, optional title, rel, and target.
 *
 * The href is normalized and entity-decoded before attribute escaping.
 * Meta-supplied `rel` and `target` attributes are included when present;
 * when `meta.target === "_blank"` the rel is augmented via
 * {@link computeLinkRel} to always include `noopener noreferrer` —
 * defensively closing the tab-nabbing and referrer-leak holes that
 * `target="_blank"` creates. Existing rel tokens are preserved.
 *
 * @param token - The link token with href, title, and inline children.
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
 * Renders an image token as a self-closing `<img>` with src, alt, and optional title.
 *
 * The src and alt are entity-decoded and attribute-escaped. Void-element
 * closing style respects the XHTML option.
 *
 * @param token - The image token with src, alt, and optional title.
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
 * Renders an inline math token according to the configured math mode.
 *
 * In "none" mode, output is suppressed. In "tex-delim" mode, wraps in
 * single `$` delimiters. In "span-class" mode, wraps in `<code>` with
 * math-specific classes.
 *
 * @param token - The inline math token with TeX content.
 * @param opts - Resolved rendering options controlling math output mode.
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
