/**
 * ABI compatibility check on `applyPlugins` — schema + missing-requires.
 *
 * @module errors.test
 */

import { TOKEN_SCHEMA_VERSION, type TokensList } from "@streamd/parser";
import { describe, expect, it } from "vitest";
import { applyPlugins, StreamdPluginAbiError } from "./index";
import type { Plugin, PluginRequirements } from "./types";

/**
 * Build a minimal identity plugin. When `requires` is omitted, the
 * result deliberately does not satisfy the `Plugin` type — callers
 * cast via `as unknown as Plugin` to exercise the runtime guard.
 */
function identityPlugin(name: string, requires?: PluginRequirements): Plugin {
  if (requires) return { name, requires, transform: (tokens) => tokens };
  return {
    name,
    transform: (tokens: TokensList) => tokens,
  } as unknown as Plugin;
}

describe("applyPlugins — plugin ABI check", () => {
  it("accepts plugins that declare the current token schema", () => {
    const result = applyPlugins([], [identityPlugin("ok", { tokenSchema: TOKEN_SCHEMA_VERSION })]);
    expect(result.tokens).toEqual([]);
  });

  it("throws StreamdPluginAbiError with kind=missing-requires when a plugin omits requires", () => {
    expect(() => applyPlugins([], [identityPlugin("legacy")])).toThrow(StreamdPluginAbiError);
  });

  it("missing-requires error carries plugin name and null schema versions", () => {
    try {
      applyPlugins([], [identityPlugin("legacy")]);
    } catch (err) {
      const e = err as StreamdPluginAbiError;
      expect(e.kind).toBe("missing-requires");
      expect(e.pluginName).toBe("legacy");
      expect(e.expected).toBeNull();
      expect(e.actual).toBeNull();
      expect(e.source).toBe("@streamd/plugins");
      return;
    }
    throw new Error("expected throw");
  });

  it("throws StreamdPluginAbiError on schema mismatch", () => {
    expect(() => applyPlugins([], [identityPlugin("future", { tokenSchema: 999 })])).toThrow(
      StreamdPluginAbiError,
    );
  });

  it("token-schema-mismatch error captures expected + actual schema versions", () => {
    try {
      applyPlugins([], [identityPlugin("future", { tokenSchema: 999 })]);
    } catch (err) {
      const e = err as StreamdPluginAbiError;
      expect(e.expected).toBe(999);
      expect(e.actual).toBe(TOKEN_SCHEMA_VERSION);
      expect(e.pluginName).toBe("future");
      expect(e.source).toBe("@streamd/plugins");
      expect(e.kind).toBe("token-schema-mismatch");
      return;
    }
    throw new Error("expected throw");
  });
});
