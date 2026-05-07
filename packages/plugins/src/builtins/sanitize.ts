/**
 * `sanitize` — removes raw HTML tokens and dangerous token-meta for safe
 * rendering of untrusted markdown.
 *
 * ## Three layers of defense
 *
 * 1. **Drop raw HTML tokens.** `HtmlBlock` and `HtmlInline` tokens emit
 *    their content verbatim in the renderer, so they are removed from
 *    the tree unless `allowRawHtml: true` is set.
 *
 * 2. **Rewrite unsafe link and image targets.** `Link.href` / `Image.src`
 *    values whose scheme is outside `allowedProtocols` are either
 *    replaced with `unsafeHrefFallback` (default `"#"`) or stripped
 *    entirely (when `unsafeHrefFallback: null`).
 *
 * 3. **Final-pass token-meta sanitization.** Plugins can annotate any
 *    token with `meta.html` (a pre-rendered string emitted verbatim
 *    by the renderer) and `meta.attrs` (arbitrary attribute injection).
 *    Sanitize walks **every** token and:
 *      - Strips `meta.html` when `allowRawHtml` is false — otherwise a
 *        preceding plugin (e.g. a custom syntax-highlighter that
 *        produces raw HTML) could smuggle markup past the HtmlBlock /
 *        HtmlInline gate.
 *      - Filters `meta.attrs` keys against the canonical
 *        `isSafeAttributeName` allowlist shared with the HTML renderer
 *        (`class`, `id`, `title`, `alt`, `lang`, `dir`, `role`, `href`,
 *        `src`, `data-*`, `aria-*`). Keys outside the allowlist are
 *        removed silently — e.g. an `onclick` or `formaction` injected
 *        via `meta.attrs` never reaches the renderer.
 *
 * Pipeline placement: **`sanitize()` must be the LAST plugin** in the
 * list. `applyPlugins` enforces this at load time by throwing
 * `StreamdPluginAbiError` with kind `"sanitize-not-last"` when any
 * plugin appears after one named `"sanitize"`.
 *
 * Default configuration is deliberately strict:
 *  - drop all `HtmlBlock` and `HtmlInline` tokens
 *  - allow only `http:`, `https:`, `mailto:`, `tel:`, `ftp:` schemes
 *  - strip `meta.html` on every token
 *  - filter `meta.attrs` to the canonical safe allowlist
 *
 * @module builtins/sanitize
 */
import {
  type ImageToken,
  type InlineToken,
  type LinkToken,
  TOKEN_SCHEMA_VERSION,
  type Token,
  type TokenMeta,
  TokenType,
} from "@streamd/parser";
import type { Plugin } from "../types";
import { walk } from "../walk";
import { isSafeAttributeName } from "./safe-attrs";

/** Default allowlist of URL schemes. */
const DEFAULT_PROTOCOLS: ReadonlyArray<string> = ["http:", "https:", "mailto:", "tel:", "ftp:"];

/** Default fallback href when a disallowed scheme is detected. */
const DEFAULT_UNSAFE_FALLBACK = "#";

// --- Character code constants ---

/** ASCII `#`. */
const CC_HASH = 35;

/** ASCII `/`. */
const CC_SLASH = 47;

/** ASCII `.`. */
const CC_DOT = 46;

/** Options for `sanitize`. */
export interface SanitizeOptions {
  /** Allow raw HTML blocks and inline HTML tokens. Default: false. */
  readonly allowRawHtml?: boolean;
  /** Allowed schemes for link hrefs and image srcs. Case-insensitive. */
  readonly allowedProtocols?: ReadonlyArray<string>;
  /**
   * Fallback href when a disallowed scheme is detected. Default: `"#"`.
   * Set to null to drop the link and keep only its inline children.
   */
  readonly unsafeHrefFallback?: string | null;
}

/** Internal normalized options. */
interface ResolvedOptions {
  /** Whether raw HTML tokens are preserved (true) or dropped (false). */
  readonly allowRawHtml: boolean;
  /** Lowercased, colon-terminated scheme list for safe-protocol checks. */
  readonly allowedProtocols: ReadonlyArray<string>;
  /** Replacement href for unsafe links, or null to strip the link entirely. */
  readonly fallback: string | null;
}

/**
 * Return true when `url` points to a safe target — either a fragment
 * (`#foo`), a relative path, or a scheme present in `allowed`.
 *
 * @param url - Raw href / src from the token. Empty strings are safe.
 * @param allowed - Lowercased scheme list including trailing colons.
 * @returns `true` when the URL is safe to render.
 */
function isSafeProtocol(url: string, allowed: ReadonlyArray<string>): boolean {
  if (url.length === 0) return true;

  const first = url.charCodeAt(0);
  if (first === CC_HASH) return true;
  if (first === CC_SLASH) return true;
  if (first === CC_DOT) return true;

  const colonIdx = url.indexOf(":");
  if (colonIdx === -1) return true;

  const scheme = url.slice(0, colonIdx + 1).toLowerCase();
  return allowed.includes(scheme);
}

/**
 * Ensure each protocol in the list ends with `:`.
 *
 * @param protocols - Raw protocol list from user options.
 * @returns Normalized list with trailing colons.
 */
function normalizeProtocols(protocols: ReadonlyArray<string>): ReadonlyArray<string> {
  return protocols.map((protocol) => normalizeOneProtocol(protocol));
}

/**
 * Normalize one protocol entry to its lowercase, colon-terminated form.
 *
 * @param protocol - Single protocol string (e.g. "http", "https:").
 * @returns Lowercase protocol with trailing colon.
 */
function normalizeOneProtocol(protocol: string): string {
  const lower = protocol.toLowerCase();
  if (lower.endsWith(":") || lower.endsWith("/")) return lower;
  return `${lower}:`;
}

/**
 * Create a `sanitize` plugin instance.
 *
 * @param options - Allow-list and fallback behaviour. All optional.
 * @returns Plugin that drops raw HTML (by default), rewrites unsafe links,
 *   strips `meta.html`, and filters `meta.attrs`.
 */
export function sanitize(options: SanitizeOptions = {}): Plugin {
  const resolved: ResolvedOptions = {
    allowRawHtml: options.allowRawHtml === true,
    allowedProtocols: normalizeProtocols(options.allowedProtocols ?? DEFAULT_PROTOCOLS),
    fallback:
      options.unsafeHrefFallback === undefined
        ? DEFAULT_UNSAFE_FALLBACK
        : options.unsafeHrefFallback,
  };

  return {
    name: "sanitize",
    requires: { tokenSchema: TOKEN_SCHEMA_VERSION },
    transform(tokens) {
      return walk(tokens, {
        block(token) {
          return sanitizeBlock(token, resolved);
        },
        inline(token) {
          return sanitizeInline(token, resolved);
        },
      });
    },
  };
}

/**
 * Handle block-level sanitization — drops raw HTML blocks and cleans meta.
 *
 * @param token - Block token to sanitize.
 * @param opts - Resolved sanitization options.
 * @returns `null` to drop, replacement token, or `undefined` to keep unchanged.
 */
function sanitizeBlock(token: Token, opts: ResolvedOptions): Token | null | undefined {
  if (!opts.allowRawHtml && token.type === TokenType.HtmlBlock) return null;

  const cleaned = cleanTokenMeta(token, opts);
  return cleaned === token ? undefined : cleaned;
}

/**
 * Handle inline sanitization — dispatches by token type then cleans meta.
 *
 * @param token - Inline token to sanitize.
 * @param opts - Resolved sanitization options.
 * @returns `null` to drop, replacement token, or `undefined` to keep unchanged.
 */
function sanitizeInline(token: InlineToken, opts: ResolvedOptions): InlineToken | null | undefined {
  if (!opts.allowRawHtml && token.type === TokenType.HtmlInline) return null;

  const replaced = replaceUnsafeLinkOrImage(token, opts);
  const next = replaced ?? token;
  const cleaned = cleanTokenMeta(next, opts);

  if (cleaned !== next) return cleaned;
  return replaced;
}

/**
 * Rewrite an unsafe link or image target. Returns `undefined` when the
 * token does not need replacement (safe target, or not a link/image).
 *
 * @param token - Inline token to check.
 * @param opts - Resolved sanitization options.
 * @returns Replacement token, or `undefined` when no change needed.
 */
function replaceUnsafeLinkOrImage(
  token: InlineToken,
  opts: ResolvedOptions,
): InlineToken | undefined {
  if (token.type === TokenType.Link) return sanitizeLink(token, opts);
  if (token.type === TokenType.Image) return sanitizeImage(token, opts);
  return undefined;
}

/**
 * Rewrite an unsafe link's href, or strip it to text if fallback is null.
 *
 * @param link - Link token to sanitize.
 * @param opts - Resolved sanitization options.
 * @returns Replacement token, or `undefined` when the link is safe.
 */
function sanitizeLink(link: LinkToken, opts: ResolvedOptions): InlineToken | undefined {
  if (isSafeProtocol(link.href, opts.allowedProtocols)) return undefined;
  if (opts.fallback === null) return { type: TokenType.Text, content: "" };
  return { ...link, href: opts.fallback };
}

/**
 * Rewrite an unsafe image's src, or replace with alt text if fallback is null.
 *
 * @param image - Image token to sanitize.
 * @param opts - Resolved sanitization options.
 * @returns Replacement token, or `undefined` when the image is safe.
 */
function sanitizeImage(image: ImageToken, opts: ResolvedOptions): InlineToken | undefined {
  if (isSafeProtocol(image.src, opts.allowedProtocols)) return undefined;
  if (opts.fallback === null) return { type: TokenType.Text, content: image.alt };
  return { ...image, src: opts.fallback };
}

/**
 * Return a cleaned copy of `token` if its `meta` carries unsafe values,
 * otherwise the original token by reference.
 *
 * Unsafe values: `meta.html` when `allowRawHtml` is false, and any key
 * in `meta.attrs` failing `isSafeAttributeName`.
 *
 * @param token - Token whose meta to clean.
 * @param opts - Resolved sanitization options.
 * @returns Cleaned token or the original by reference when unchanged.
 */
function cleanTokenMeta<T extends Token | InlineToken>(token: T, opts: ResolvedOptions): T {
  const meta = token.meta;
  if (meta === undefined) return token;

  const filteredAttrs = filterSafeAttrs(meta.attrs);
  const stripHtml = !opts.allowRawHtml && meta.html !== undefined;
  const attrsChanged = filteredAttrs !== meta.attrs;

  if (!stripHtml && !attrsChanged) return token;
  return { ...token, meta: buildCleanMeta(meta, stripHtml, filteredAttrs) };
}

/**
 * Drop any key in `attrs` that does not pass `isSafeAttributeName`.
 * Returns the input reference when every key is already safe so callers
 * can detect "no change" by identity comparison.
 *
 * @param attrs - Attribute record to filter. May be undefined.
 * @returns Filtered record, or the input reference when all keys are safe.
 */
function filterSafeAttrs(
  attrs: Readonly<Record<string, string>> | undefined,
): Readonly<Record<string, string>> | undefined {
  if (attrs === undefined) return undefined;

  const keys = Object.keys(attrs);
  if (keys.every(isSafeAttributeName)) return attrs;

  const next: Record<string, string> = {};
  for (const key of keys) {
    if (isSafeAttributeName(key)) next[key] = attrs[key];
  }
  return next;
}

/**
 * Build a new `TokenMeta` with `html` possibly stripped and `attrs`
 * replaced by the filtered version.
 *
 * @param meta - Original meta object.
 * @param stripHtml - Whether to remove the `html` field.
 * @param attrs - Filtered attrs to use (may be undefined to remove).
 * @returns New meta object with unsafe fields removed.
 */
function buildCleanMeta(
  meta: TokenMeta,
  stripHtml: boolean,
  attrs: Readonly<Record<string, string>> | undefined,
): TokenMeta {
  const next: Record<string, unknown> = { ...meta };

  if (stripHtml) delete next["html"];

  if (attrs === undefined) {
    delete next["attrs"];
  } else if (attrs !== meta.attrs) {
    next["attrs"] = attrs;
  }

  return next as TokenMeta;
}
