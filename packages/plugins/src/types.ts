/**
 * Plugin types and helper shapes.
 *
 * A plugin is a pure token transformer. Plugins run before rendering and may:
 *  - rewrite tokens (e.g. sanitize unsafe link targets)
 *  - annotate tokens via the `meta` field (e.g. add id="…" to headings)
 *  - drop tokens entirely (e.g. remove empty paragraphs)
 *
 * Plugins must be deterministic for a given input — the renderer may invoke
 * them multiple times during streaming as the source grows.
 *
 * @module types
 */
import type { ParseOptions, TokensList } from "@streamd/parser";

/**
 * Context passed to plugin transforms.
 *
 * `meta` is a mutable key/value bag that plugins can use to share state
 * across runs (e.g. the frontmatter plugin stores parsed frontmatter here).
 */
export interface PluginContext {
  /** Parse options forwarded from the caller. Absent when not provided. */
  readonly parseOptions?: ParseOptions;
  /** Mutable key/value bag shared across all plugins in a pipeline run. */
  readonly meta: Record<string, unknown>;
}

/**
 * A single plugin — a `transform` function, a `name`, and a mandatory
 * `requires` ABI declaration.
 *
 * ## Plugin ABI
 *
 * Every plugin MUST declare a `requires` object naming the token-schema
 * version it was built against. `applyPlugins` rejects any plugin that
 * omits `requires` or declares a version different from the parser's
 * `TOKEN_SCHEMA_VERSION`.
 *
 * ```ts
 * import { TOKEN_SCHEMA_VERSION } from "@streamd/parser";
 * import type { Plugin } from "@streamd/plugins";
 *
 * export const myPlugin: Plugin = {
 *   name: "myPlugin",
 *   requires: { tokenSchema: TOKEN_SCHEMA_VERSION },
 *   transform(tokens) { return tokens; },
 * };
 * ```
 *
 * Why this is mandatory: the parser's token shape is a structural ABI.
 * When it changes, consuming plugins that were compiled against the old
 * shape will silently produce wrong output. Making `requires` mandatory
 * converts a silent failure into a loud, actionable
 * `StreamdPluginAbiError` with `kind: "missing-requires"` or
 * `kind: "token-schema-mismatch"`.
 */
export interface Plugin {
  /** Human-readable identifier used in error messages. */
  readonly name: string;
  /** Token transformer. Must be deterministic for a given input. */
  readonly transform: (tokens: TokensList, ctx: PluginContext) => TokensList;
  /**
   * Runtime compatibility declaration. `applyPlugins` verifies the
   * plugin's expected token-schema version matches the parser's
   * `TOKEN_SCHEMA_VERSION` at runtime and throws
   * `StreamdPluginAbiError` on mismatch or when this field is absent.
   *
   * Mandatory — omit at your peril. There is no opt-out.
   */
  readonly requires: PluginRequirements;
}

/** Runtime compatibility requirements declared by a plugin. */
export interface PluginRequirements {
  /**
   * Token-schema version this plugin was built against. Must equal
   * the parser's `TOKEN_SCHEMA_VERSION` exported from
   * `@streamd/parser`.
   */
  readonly tokenSchema: number;
}

/** Options for `applyPlugins`. */
export interface ApplyPluginsOptions {
  /** Parse options forwarded to the plugin context. Optional. */
  readonly parseOptions?: ParseOptions;
  /** Pre-populated meta bag. Defaults to empty. */
  readonly meta?: Record<string, unknown>;
}

/**
 * Result of running a plugin pipeline over a token tree.
 *
 * `tokens` is the transformed list — structural equality against the
 * input is preserved for subtrees no plugin touched. `meta` is the
 * mutated shared bag plugins use to publish auxiliary output such as
 * parsed frontmatter or heading slugs.
 */
export interface ApplyPluginsResult {
  /** Transformed token list after all plugins have run. */
  readonly tokens: TokensList;
  /** Shared meta bag — may contain plugin-published data (frontmatter, slugs). */
  readonly meta: Record<string, unknown>;
}
