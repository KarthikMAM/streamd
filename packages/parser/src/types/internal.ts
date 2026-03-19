/**
 * Internal mutable records used during parsing.
 *
 * NOT part of the public API — consumed only by scanner, resolver, assembler.
 * All records created via factory functions with ALL fields initialized in
 * fixed order for monomorphic hidden classes.
 *
 * @module types/internal
 */
import type { InlineToken } from "./tokens";

/**
 * InlineNode — first-pass inline scan output.
 * kind: 0=token, 1=delimiter, 2=dead
 */
export interface InlineNode {
  kind: 0 | 1 | 2;
  token: InlineToken | null;
  char: number;
  count: number;
  canOpen: boolean;
  canClose: boolean;
  pos: number;
  end: number;
}

/**
 * Shared scan result — reused by all inline sub-scanners.
 *
 * Module-level singleton mutated and returned by each scanner.
 * Caller must read `.token` and `.end` immediately before the next scan call.
 */
export interface ScanResult {
  token: InlineToken;
  end: number;
}

/**
 * LinkReference — stored in refMap (first definition wins).
 */
export interface LinkReference {
  destination: string;
  title: string;
}
