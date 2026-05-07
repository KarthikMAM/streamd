/**
 * Version of the Token schema shipped by `@streamd/parser`.
 *
 * Bump this when:
 * - A new token type is added
 * - An existing token field is renamed or removed
 * - A token field's type changes in a way that breaks consumers
 *
 * Plugins and renderers that declare a required token schema version
 * are checked against this value at runtime so a version-skewed
 * consumer fails fast instead of emitting silently wrong output.
 *
 * Format: positive integer. No semver — this is a structural ABI, not
 * a feature count.
 */
export const TOKEN_SCHEMA_VERSION = 1 as const;

/** The literal type of `TOKEN_SCHEMA_VERSION`. */
export type TokenSchemaVersion = typeof TOKEN_SCHEMA_VERSION;
