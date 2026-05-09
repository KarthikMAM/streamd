/**
 * `<MemoBlock>` — memoises a block-level token by reference identity.
 *
 * The parser's `completedTokens` array is reference-stable: once a block
 * is promoted from the speculative tail into the completed prefix, its
 * object identity never changes. `MemoBlock` exploits this by comparing
 * the `token` prop by reference — if the same object is passed on the
 * next render, the subtree is skipped entirely.
 *
 * @module memo-block
 */
import type { Token } from "@streamd/parser";
import { memo, type ReactNode } from "react";

/** Props for the MemoBlock wrapper. */
export interface MemoBlockProps {
  /** The block-level token — compared by reference for memoisation. */
  readonly token: Token;
  /** Pre-rendered React subtree for this block. */
  readonly children: ReactNode;
}

/**
 * Memoised block wrapper. Skips re-render when `token` is the same object.
 *
 * @param props - MemoBlock props containing the token and rendered children.
 * @returns The children unchanged — the memo boundary is the optimisation.
 */
export const MemoBlock = memo(
  (props: MemoBlockProps): ReactNode => props.children,
  (prev, next) => prev.token === next.token,
);

MemoBlock.displayName = "MemoBlock";
