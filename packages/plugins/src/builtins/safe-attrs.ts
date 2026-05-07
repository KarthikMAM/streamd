/**
 * Canonical allowlist of `meta.attrs` attribute names that are safe to
 * emit on rendered output.
 *
 * This predicate is the single source of truth shared between the
 * `sanitize()` plugin (which strips disallowed keys off
 * `token.meta.attrs` during the final pass) and the HTML renderer
 * (which filters the same keys when serialising). Keeping the rule in
 * one place means "safe attributes" cannot drift between the defense-
 * in-depth layer and the primary renderer gate.
 *
 * ## Allowlist
 *
 * Exact names: `class`, `id`, `title`, `alt`, `lang`, `dir`, `role`,
 * `href`, `src`.
 *
 * Prefix families: `data-*`, `aria-*`.
 *
 * Everything else — `onclick`, `onerror`, `style`, `formaction`,
 * `srcdoc`, any other HTML attribute — is rejected. There is
 * deliberately no "allowedAttributes" knob: if a new attribute is
 * safe, it goes into this file (and both consumers pick it up at
 * once); if it isn't, it never renders.
 *
 * @module builtins/safe-attrs
 */

/**
 * Exact attribute names always considered safe. Kept frozen so the
 * set cannot be mutated at runtime by untrusted code (defense in
 * depth — the set itself is not user-reachable but a future import
 * could expose it).
 */
export const SAFE_ATTR_ALLOWLIST: ReadonlySet<string> = new Set([
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

/** Prefix marking a `data-*` custom attribute. */
const DATA_PREFIX = "data-";

/** Prefix marking an `aria-*` accessibility attribute. */
const ARIA_PREFIX = "aria-";

/**
 * Test whether an attribute name may appear on rendered markup.
 *
 * Returns `true` for the exact names in the allowlist and for any
 * name starting with `data-` or `aria-` followed by at least one
 * character. Returns `false` for everything else, including empty
 * strings and names whose prefix matches but whose suffix is empty
 * (e.g. `"data-"` alone is rejected — must be `data-<something>`).
 *
 * The check is case-sensitive. Callers that accept user-supplied
 * attribute keys should lowercase them before calling (HTML attribute
 * names are case-insensitive but JS object keys are not).
 *
 * @param name - Attribute name to classify. May be empty.
 * @returns `true` when the name is safe to render, `false` otherwise.
 */
export function isSafeAttributeName(name: string): boolean {
  if (SAFE_ATTR_ALLOWLIST.has(name)) return true;
  if (name.length > DATA_PREFIX.length && name.startsWith(DATA_PREFIX)) return true;
  if (name.length > ARIA_PREFIX.length && name.startsWith(ARIA_PREFIX)) return true;
  return false;
}
