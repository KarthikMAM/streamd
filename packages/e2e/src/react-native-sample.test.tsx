/**
 * React Native snapshot: renders the shared sample.md through the
 * native renderer and asserts the rendered markup contains the expected
 * block-level structure.
 *
 * @module react-native-sample.test
 */

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "@streamd/parser";
import { renderReactNative } from "@streamd/react-native";
import { darkTheme, lightTheme } from "@streamd/tokens";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const samplePath = resolve(here, "../../../apps/shared/sample.md");
const sample = await readFile(samplePath, "utf8");

describe("react-native renderer — sample markdown", () => {
  it("produces all expected native primitive shells", () => {
    const tokens = parse(sample, null, { gfm: true, math: true }).tokens;
    const markup = renderToStaticMarkup(
      createElement("rn-root", null, renderReactNative(tokens, { theme: lightTheme })) as ReactNode,
    );
    expect(markup).toContain("<rn-view");
    expect(markup).toContain("<rn-text");
    expect(markup).toContain("<rn-pressable"); // link
    expect(markup).toContain("streaming"); // body text
    expect(markup).toContain("\u2611"); // checked task box
    expect(markup).toContain("\u2610"); // unchecked task box
  });

  it("respects dark theme styling", () => {
    const tokens = parse(sample, null, { gfm: true, math: true }).tokens;
    const light = renderToStaticMarkup(
      createElement("rn-root", null, renderReactNative(tokens, { theme: lightTheme })) as ReactNode,
    );
    const dark = renderToStaticMarkup(
      createElement("rn-root", null, renderReactNative(tokens, { theme: darkTheme })) as ReactNode,
    );
    expect(light).not.toBe(dark);
    expect(light).toContain(lightTheme.colors.text);
    expect(dark).toContain(darkTheme.colors.text);
  });
});
