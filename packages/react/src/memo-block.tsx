/**
 * MemoBlock — memoises block-level rendering by token identity.
 *
 * Completed tokens from the parser preserve their object reference across
 * streaming calls, so `React.memo` with a reference-equality check on
 * `token` trivially bails for stable blocks. Active-block tokens get a
 * fresh reference on every parse tick and re-render naturally.
 *
 * @module memo-block
 */
import type { Token } from "@streamd/parser";
import { memo, type ReactNode } from "react";

/** Props for the MemoBlock wrapper. */
export interface MemoBlockProps {
  /** The token to render. */
  readonly token: Token;
  /** Position index in the top-level token list. */
  readonly index: number;
  /** Render function that produces the ReactNode for a given token. */
  readonly renderToken: (
    token: Token,
    index: number,
    resolved: MemoBlockProps["resolved"],
  ) => ReactNode;
  /** Resolved renderer configuration passed through to renderToken. */
  readonly resolved: object;
}

/**
 * Memoised block wrapper. Bails out of re-render when the token reference
 * and index are unchanged — which is the common case for completed blocks
 * during streaming since the parser preserves their identity.
 */
export const MemoBlock = memo(
  function MemoBlock({ token, index, renderToken, resolved }: MemoBlockProps): ReactNode {
    return renderToken(token, index, resolved);
  },
  (prev, next) => prev.token === next.token && prev.index === next.index,
);
