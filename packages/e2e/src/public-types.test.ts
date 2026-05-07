/**
 * Type-level tests — verify the public API types don't drift silently.
 *
 * Uses vitest's `expectTypeOf` so regressions fail both the type-check
 * step and the test run. This catches accidental widening (e.g.
 * `string` → `string | undefined`) and accidental narrowing (e.g.
 * removing an overload).
 *
 * @module public-types.test
 */

import type {
  ParseOptions,
  ParseResult,
  Token,
  TokenSchemaVersion,
  TokensList,
} from "@streamd/parser";
import { parse, TOKEN_SCHEMA_VERSION } from "@streamd/parser";
import { describe, expectTypeOf, it } from "vitest";

describe("@streamd/parser — public type contract", () => {
  it("parse returns a ParseResult shape", () => {
    const out = parse("x");
    expectTypeOf(out).toEqualTypeOf<ParseResult>();
    expectTypeOf(out.tokens).toEqualTypeOf<TokensList>();
    expectTypeOf(out.stableCount).toEqualTypeOf<number>();
  });

  it("parse accepts ParseOptions with the canonical flags", () => {
    expectTypeOf<ParseOptions>().toMatchTypeOf<{
      gfm?: boolean;
      math?: boolean;
      tables?: boolean;
      strikethrough?: boolean;
      taskListItems?: boolean;
      autolinks?: boolean;
    }>();
  });

  it("TokensList is a readonly Token array", () => {
    expectTypeOf<TokensList[number]>().toEqualTypeOf<Token>();
  });

  it("TOKEN_SCHEMA_VERSION is the matching TokenSchemaVersion literal", () => {
    expectTypeOf(TOKEN_SCHEMA_VERSION).toEqualTypeOf<TokenSchemaVersion>();
    expectTypeOf<TokenSchemaVersion>().toEqualTypeOf<1>();
  });
});
