/**
 * Unit tests for @streamd/tokens.
 *
 * Covers theme objects, merge semantics, CSS variable emission, the
 * public API input validation guards, and the CSS injection rejection
 * path that keeps `themeToCss` safe for SSR'd `<style>` tags.
 *
 * @module tokens.test
 */

import { describe, expect, it } from "vitest";
import type { Theme } from "./index";
import { darkTheme, lightTheme, mergeTheme, StreamdArgumentError, themeToCss } from "./index";

describe("built-in themes", () => {
  it("light theme has expected name and white background", () => {
    expect(lightTheme.name).toBe("light");
    expect(lightTheme.colors.background).toBe("#ffffff");
  });

  it("dark theme has expected name and dark background", () => {
    expect(darkTheme.name).toBe("dark");
    expect(darkTheme.colors.background).toBe("#0d1117");
  });

  it("both themes share the same spacing scale", () => {
    expect(lightTheme.spacing).toEqual(darkTheme.spacing);
  });

  it("heading scale has six entries for h1-h6", () => {
    expect(lightTheme.typography.headingScale).toHaveLength(6);
  });
});

describe("mergeTheme", () => {
  it("preserves base values when override is empty", () => {
    const merged = mergeTheme(lightTheme, {});
    expect(merged).toEqual(lightTheme);
  });

  it("overrides name when provided", () => {
    const merged = mergeTheme(lightTheme, { name: "custom" });
    expect(merged.name).toBe("custom");
  });

  it("overrides individual colours without disturbing others", () => {
    const merged = mergeTheme(lightTheme, { colors: { background: "#eee" } });
    expect(merged.colors.background).toBe("#eee");
    expect(merged.colors.text).toBe(lightTheme.colors.text);
  });

  it("overrides spacing partially", () => {
    const merged = mergeTheme(lightTheme, { spacing: { md: 20 } });
    expect(merged.spacing.md).toBe(20);
    expect(merged.spacing.lg).toBe(lightTheme.spacing.lg);
  });

  it("overrides typography heading scale array", () => {
    const merged = mergeTheme(lightTheme, {
      typography: { headingScale: [40, 32, 24, 20, 18, 16] },
    });
    expect(merged.typography.headingScale).toEqual([40, 32, 24, 20, 18, 16]);
  });

  it("does not mutate the base theme", () => {
    const snapshot = JSON.stringify(lightTheme);
    mergeTheme(lightTheme, { colors: { text: "#000" } });
    expect(JSON.stringify(lightTheme)).toBe(snapshot);
  });
});

describe("mergeTheme — input validation", () => {
  it("throws when base is null", () => {
    expect(() => mergeTheme(null as unknown as Theme, {})).toThrow(StreamdArgumentError);
  });

  it("throws when base is undefined", () => {
    expect(() => mergeTheme(undefined as unknown as Theme, {})).toThrow(StreamdArgumentError);
  });

  it("throws when base is a string primitive", () => {
    expect(() => mergeTheme("not a theme" as unknown as Theme, {})).toThrow(StreamdArgumentError);
  });

  it("throws when base is a number primitive", () => {
    expect(() => mergeTheme(42 as unknown as Theme, {})).toThrow(StreamdArgumentError);
  });

  it("throws when base is an array", () => {
    expect(() => mergeTheme([] as unknown as Theme, {})).toThrow(StreamdArgumentError);
  });

  it("throws when base is missing a required Theme key", () => {
    const partial = { name: "x", colors: {}, spacing: {}, typography: {} };
    expect(() => mergeTheme(partial as unknown as Theme, {})).toThrow(StreamdArgumentError);
  });

  it("throws when override is null", () => {
    expect(() => mergeTheme(lightTheme, null as unknown as object)).toThrow(StreamdArgumentError);
  });

  it("throws when override is undefined", () => {
    expect(() => mergeTheme(lightTheme, undefined as unknown as object)).toThrow(
      StreamdArgumentError,
    );
  });

  it("throws when override is a string primitive", () => {
    expect(() => mergeTheme(lightTheme, "oops" as unknown as object)).toThrow(StreamdArgumentError);
  });

  it("throws when override is an array", () => {
    expect(() => mergeTheme(lightTheme, [] as unknown as object)).toThrow(StreamdArgumentError);
  });

  it("error names the caller and kind for base shape failures", () => {
    expect(() => mergeTheme(null as unknown as Theme, {})).toThrow(StreamdArgumentError);
    expect(() => mergeTheme(null as unknown as Theme, {})).toThrow(
      expect.objectContaining({
        caller: "mergeTheme",
        kind: "invalid-base-theme",
        source: "@streamd/tokens",
        message: expect.stringContaining("base"),
      }),
    );
  });

  it("error names the caller and kind for override shape failures", () => {
    expect(() => mergeTheme(lightTheme, null as unknown as object)).toThrow(
      expect.objectContaining({
        caller: "mergeTheme",
        kind: "invalid-override",
        source: "@streamd/tokens",
      }),
    );
  });

  it("error mentions the missing key when base is partial", () => {
    const partial = { name: "x", colors: {}, spacing: {}, typography: {} };
    expect(() => mergeTheme(partial as unknown as Theme, {})).toThrow(/radii/);
  });
});

describe("themeToCss", () => {
  it("emits a :root block by default", () => {
    const css = themeToCss(lightTheme);
    expect(css.startsWith(":root {")).toBe(true);
    expect(css.trimEnd().endsWith("}")).toBe(true);
  });

  it("emits one custom property for each colour field", () => {
    const css = themeToCss(lightTheme);
    expect(css).toContain("--streamd-color-text: #1f2328");
    expect(css).toContain("--streamd-color-background: #ffffff");
    expect(css).toContain("--streamd-color-code-background: #f6f8fa");
  });

  it("emits spacing values with px unit by default", () => {
    const css = themeToCss(lightTheme);
    expect(css).toContain("--streamd-spacing-md: 16px");
  });

  it("respects a custom unit", () => {
    const css = themeToCss(lightTheme, { unit: "rem" });
    expect(css).toContain("--streamd-spacing-md: 16rem");
  });

  it("respects a custom selector", () => {
    const css = themeToCss(lightTheme, { selector: ".theme-light" });
    expect(css.startsWith(".theme-light {")).toBe(true);
  });

  it("respects a custom prefix", () => {
    const css = themeToCss(lightTheme, { prefix: "md" });
    expect(css).toContain("--md-color-text: #1f2328");
  });

  it("emits one variable per heading level", () => {
    const css = themeToCss(lightTheme);
    for (let level = 1; level <= 6; level++) {
      expect(css).toContain(`--streamd-heading-${level}:`);
    }
  });
});

describe("themeToCss — input validation (shape)", () => {
  it("throws when theme is null", () => {
    expect(() => themeToCss(null as unknown as Theme)).toThrow(StreamdArgumentError);
  });

  it("throws when theme is undefined", () => {
    expect(() => themeToCss(undefined as unknown as Theme)).toThrow(StreamdArgumentError);
  });

  it("throws when theme is a string primitive", () => {
    expect(() => themeToCss("oops" as unknown as Theme)).toThrow(StreamdArgumentError);
  });

  it("throws when theme is an array", () => {
    expect(() => themeToCss([] as unknown as Theme)).toThrow(StreamdArgumentError);
  });

  it("throws when theme is missing the colors key", () => {
    const partial = {
      name: "x",
      spacing: lightTheme.spacing,
      typography: lightTheme.typography,
      radii: lightTheme.radii,
    };
    expect(() => themeToCss(partial as unknown as Theme)).toThrow(StreamdArgumentError);
  });

  it("uses invalid-theme kind and themeToCss caller", () => {
    expect(() => themeToCss(null as unknown as Theme)).toThrow(
      expect.objectContaining({
        caller: "themeToCss",
        kind: "invalid-theme",
        source: "@streamd/tokens",
      }),
    );
  });
});

describe("themeToCss — unsafe theme values", () => {
  it("rejects a CSS-injecting colour value", () => {
    const injected = mergeTheme(lightTheme, {
      colors: { text: "red; } body { display: none; } .foo {" },
    });
    expect(() => themeToCss(injected)).toThrow(StreamdArgumentError);
  });

  it("rejects a non-string colour value", () => {
    const corrupted = {
      ...lightTheme,
      colors: { ...lightTheme.colors, text: 42 as unknown as string },
    };
    expect(() => themeToCss(corrupted)).toThrow(StreamdArgumentError);
  });

  it("rejects an unknown named colour", () => {
    const corrupted = mergeTheme(lightTheme, { colors: { text: "notacolor" } });
    expect(() => themeToCss(corrupted)).toThrow(StreamdArgumentError);
  });

  it("rejects an injecting fontFamily", () => {
    const corrupted = mergeTheme(lightTheme, {
      typography: { fontFamily: "Arial; } body { display: none; } .foo {" },
    });
    expect(() => themeToCss(corrupted)).toThrow(StreamdArgumentError);
  });

  it("rejects a fontFamily with an unmatched quote", () => {
    const corrupted = mergeTheme(lightTheme, {
      typography: { fontFamily: '"Helvetica, Arial' },
    });
    expect(() => themeToCss(corrupted)).toThrow(StreamdArgumentError);
  });

  it("rejects NaN spacing", () => {
    const corrupted = mergeTheme(lightTheme, { spacing: { md: Number.NaN } });
    expect(() => themeToCss(corrupted)).toThrow(StreamdArgumentError);
  });

  it("rejects Infinity spacing", () => {
    const corrupted = mergeTheme(lightTheme, {
      spacing: { md: Number.POSITIVE_INFINITY },
    });
    expect(() => themeToCss(corrupted)).toThrow(StreamdArgumentError);
  });

  it("rejects a heading-scale entry that is NaN", () => {
    const corrupted = mergeTheme(lightTheme, {
      typography: { headingScale: [32, Number.NaN, 22, 18, 16, 14] },
    });
    expect(() => themeToCss(corrupted)).toThrow(StreamdArgumentError);
  });

  it("rejects a non-array headingScale", () => {
    const corrupted = mergeTheme(lightTheme, {
      typography: { headingScale: "boom" as unknown as ReadonlyArray<number> },
    });
    expect(() => themeToCss(corrupted)).toThrow(StreamdArgumentError);
  });

  it("rejects a non-numeric radii value", () => {
    const corrupted = mergeTheme(lightTheme, {
      radii: { sm: "4px; } body {" as unknown as number },
    });
    expect(() => themeToCss(corrupted)).toThrow(StreamdArgumentError);
  });

  it("rejects a weight that cannot be cleanly stringified", () => {
    const corrupted = mergeTheme(lightTheme, {
      typography: { weightRegular: Number.MAX_VALUE },
    });
    expect(() => themeToCss(corrupted)).toThrow(StreamdArgumentError);
  });

  it("rejects a non-string fontFamily (wrong type)", () => {
    const corrupted = mergeTheme(lightTheme, {
      typography: { fontFamily: 42 as unknown as string },
    });
    expect(() => themeToCss(corrupted)).toThrow(StreamdArgumentError);
  });

  it("rejects a non-number weightRegular (wrong type)", () => {
    const corrupted = mergeTheme(lightTheme, {
      typography: { weightRegular: "400" as unknown as number },
    });
    expect(() => themeToCss(corrupted)).toThrow(StreamdArgumentError);
  });

  it("rejects a non-number lineHeight (wrong type)", () => {
    const corrupted = mergeTheme(lightTheme, {
      typography: { lineHeight: "1.6" as unknown as number },
    });
    expect(() => themeToCss(corrupted)).toThrow(StreamdArgumentError);
  });

  it("uses unsafe-theme-value kind and names the offending field", () => {
    const injected = mergeTheme(lightTheme, {
      colors: { text: "red; } body { display: none; } .foo {" },
    });
    expect(() => themeToCss(injected)).toThrow(
      expect.objectContaining({
        caller: "themeToCss",
        kind: "unsafe-theme-value",
        source: "@streamd/tokens",
        message: expect.stringContaining("colors.text"),
      }),
    );
  });

  it("reports the path for a nested headingScale failure", () => {
    const corrupted = mergeTheme(lightTheme, {
      typography: { headingScale: [32, Number.NaN, 22, 18, 16, 14] },
    });
    expect(() => themeToCss(corrupted)).toThrow(/headingScale\[1\]/);
  });
});

describe("StreamdArgumentError — shape", () => {
  it("is a TypeError subclass", () => {
    expect(() => themeToCss(null as unknown as Theme)).toThrow(TypeError);
    expect(() => themeToCss(null as unknown as Theme)).toThrow(StreamdArgumentError);
  });
});
