/**
 * `linkAttributes` — adds rel / target / className attributes to link
 * tokens based on a predicate. Common use: open external links in a new
 * tab with `rel="noopener noreferrer"`.
 *
 * @module builtins/link-attributes
 */
import { type LinkToken, TOKEN_SCHEMA_VERSION, TokenType } from "@streamd/parser";
import type { Plugin } from "../types";
import { walk } from "../walk";

// --- Character code constants ---

/** ASCII `#`. */
const CC_HASH = 35;

/** ASCII `/`. */
const CC_SLASH = 47;

/** ASCII `:`. */
const CC_COLON = 58;

/** ASCII `+`. */
const CC_PLUS = 43;

/** ASCII `-`. */
const CC_DASH = 45;

/** ASCII `.`. */
const CC_DOT = 46;

/** ASCII `0`. */
const CC_0 = 48;

/** ASCII `9`. */
const CC_9 = 57;

/** ASCII `A`. */
const CC_A_UPPER = 65;

/** ASCII `Z`. */
const CC_Z_UPPER = 90;

/** ASCII `a`. */
const CC_A_LOWER = 97;

/** ASCII `z`. */
const CC_Z_LOWER = 122;

/** Longest scheme prefix we'll scan for before giving up. */
const MAX_SCHEME_LOOKAHEAD = 16;

/** Classification of a link for attribute selection. */
export interface LinkClassification {
  /** True if the link targets a different origin or a `mailto:`/`tel:` URI. */
  readonly isExternal: boolean;
  /** True if the link is an in-page fragment (starts with `#`). */
  readonly isAnchor: boolean;
}

/** Options for `linkAttributes`. */
export interface LinkAttributesOptions {
  /** `rel` value for external links. Default: "noopener noreferrer". */
  readonly externalRel?: string;
  /** `target` value for external links. Default: "_blank". */
  readonly externalTarget?: string;
  /** Class to add to external links. Optional. */
  readonly externalClassName?: string;
  /** Class to add to in-page anchor links (href starting with `#`). */
  readonly anchorClassName?: string;
  /**
   * Custom classifier. Defaults to: external if href starts with a scheme
   * (`http:`, `https:`, `//`), anchor if it starts with `#`.
   */
  readonly classify?: (href: string) => LinkClassification;
}

/**
 * Default classification heuristic: external if a URL scheme is present or
 * the URL starts with `//`, anchor if it starts with `#`, otherwise neither.
 *
 * @param href - Link target to classify. May be empty.
 * @returns Classification result.
 */
function defaultClassify(href: string): LinkClassification {
  if (href.length === 0) return { isExternal: false, isAnchor: false };
  if (href.charCodeAt(0) === CC_HASH) return { isExternal: false, isAnchor: true };
  return { isExternal: hasProtocol(href), isAnchor: false };
}

/**
 * Detect a protocol-qualified URL (`scheme:` or `//host`).
 *
 * @param href - URL string to test.
 * @returns `true` when the URL has a scheme or is protocol-relative.
 */
function hasProtocol(href: string): boolean {
  if (isProtocolRelative(href)) return true;

  const limit = Math.min(href.length, MAX_SCHEME_LOOKAHEAD);
  for (let i = 0; i < limit; i++) {
    const code = href.charCodeAt(i);
    if (code === CC_COLON) return i > 0;
    if (!isSchemeChar(code, i)) return false;
  }

  return false;
}

/**
 * True when `href` starts with `//` (protocol-relative).
 *
 * @param href - URL string to test.
 * @returns `true` for protocol-relative URLs.
 */
function isProtocolRelative(href: string): boolean {
  return href.length >= 2 && href.charCodeAt(0) === CC_SLASH && href.charCodeAt(1) === CC_SLASH;
}

/**
 * True when `code` is valid inside a URL scheme at position `index`.
 * Schemes are `ALPHA *( ALPHA / DIGIT / "+" / "-" / "." )` per RFC 3986.
 *
 * @param code - Character code to test.
 * @param index - Position within the scheme string (digits invalid at 0).
 * @returns `true` when the character is valid at this position.
 */
function isSchemeChar(code: number, index: number): boolean {
  if (code >= CC_A_LOWER && code <= CC_Z_LOWER) return true;
  if (code >= CC_A_UPPER && code <= CC_Z_UPPER) return true;
  if (code === CC_PLUS || code === CC_DASH || code === CC_DOT) return true;
  if (code >= CC_0 && code <= CC_9 && index > 0) return true;
  return false;
}

/**
 * Create a `linkAttributes` plugin instance.
 *
 * @param options - Attribute values and custom classifier. All optional.
 * @returns Plugin that annotates matching links via `meta.rel`, `meta.target`,
 *   and `meta.className`.
 */
export function linkAttributes(options: LinkAttributesOptions = {}): Plugin {
  const externalRel = options.externalRel ?? "noopener noreferrer";
  const externalTarget = options.externalTarget ?? "_blank";
  const externalClass = options.externalClassName;
  const anchorClass = options.anchorClassName;
  const classify = options.classify ?? defaultClassify;

  return {
    name: "linkAttributes",
    requires: { tokenSchema: TOKEN_SCHEMA_VERSION },
    transform(tokens) {
      return walk(tokens, {
        inline(token) {
          if (token.type !== TokenType.Link) return undefined;

          return annotateLink(
            token,
            classify,
            externalRel,
            externalTarget,
            externalClass,
            anchorClass,
          );
        },
      });
    },
  };
}

/**
 * Attribute mutation: builds a new link token with `meta.rel`/`target`/
 * `className` populated according to the classification result. Returns
 * `undefined` when neither external nor anchor classifications apply.
 *
 * @param link - Link token to annotate.
 * @param classify - Classification function.
 * @param externalRel - Rel value for external links.
 * @param externalTarget - Target value for external links.
 * @param externalClass - Optional class for external links.
 * @param anchorClass - Optional class for anchor links.
 * @returns Annotated link token, or `undefined` when no annotation needed.
 */
function annotateLink(
  link: LinkToken,
  classify: (href: string) => LinkClassification,
  externalRel: string,
  externalTarget: string,
  externalClass: string | undefined,
  anchorClass: string | undefined,
): LinkToken | undefined {
  const classification = classify(link.href);
  const isInternalNonAnchor = !classification.isExternal && !classification.isAnchor;
  if (isInternalNonAnchor) return undefined;

  const meta = { ...(link.meta ?? {}) };

  if (classification.isExternal) {
    applyExternalAttrs(meta, externalRel, externalTarget, externalClass);
  } else if (anchorClass) {
    meta.className = mergeClass(meta.className as string | undefined, anchorClass);
  }

  return { ...link, meta };
}

/**
 * Mutate the meta object with external-link attrs (preserves existing values).
 *
 * @param meta - Mutable meta record to populate.
 * @param rel - Rel attribute value.
 * @param target - Target attribute value.
 * @param extraClass - Optional additional class name.
 */
function applyExternalAttrs(
  meta: Record<string, unknown>,
  rel: string,
  target: string,
  extraClass: string | undefined,
): void {
  if (meta["rel"] === undefined) meta["rel"] = rel;
  if (meta["target"] === undefined) meta["target"] = target;

  if (extraClass) {
    meta["className"] = mergeClass(meta["className"] as string | undefined, extraClass);
  }
}

/**
 * Append `extra` to `existing` as a space-separated class list, skipping if
 * `extra` is already present.
 *
 * @param existing - Current class string, or undefined.
 * @param extra - Class name to append.
 * @returns Merged class string.
 */
function mergeClass(existing: string | undefined, extra: string): string {
  if (!existing) return extra;
  if (existing.includes(extra)) return existing;
  return `${existing} ${extra}`;
}
