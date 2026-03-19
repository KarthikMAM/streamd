/**
 * Delimiter run scanner for emphasis and strikethrough.
 *
 * Spec §6.2: left-flanking and right-flanking delimiter run classification.
 * Zero regex — all matching via charCode comparisons.
 *
 * @module scanner/inline/emphasis
 */
import { CC_SPACE, CC_STAR, CC_TILDE, CC_UNDERSCORE } from "../constants";
import { isPunctuation, isUnicodeWhitespace } from "../utils";

/** Result shape for {@link scanDelimiterRun}. */
export interface DelimiterRun {
  count: number;
  canOpen: boolean;
  canClose: boolean;
}

/** Shared result — mutated and returned. Caller must read immediately. */
const RESULT: DelimiterRun = { count: 0, canOpen: false, canClose: false };

/**
 * Scan a delimiter run of `*`, `_`, or `~` characters.
 *
 * Classifies the run as left-flanking, right-flanking, or both per spec §6.2.
 * Underscore has additional intraword restrictions.
 *
 * @returns Shared result or null if not a delimiter char. Caller must read immediately.
 */
export function scanDelimiterRun(src: string, pos: number, end: number): DelimiterRun | null {
  const ch = src.charCodeAt(pos);
  if (ch !== CC_STAR && ch !== CC_UNDERSCORE && ch !== CC_TILDE) return null;

  let count = 1;
  let i = pos + 1;
  while (i < end && src.charCodeAt(i) === ch) {
    count++;
    i++;
  }

  const charBefore = pos > 0 ? src.charCodeAt(pos - 1) : CC_SPACE;
  const charAfter = i < end ? src.charCodeAt(i) : CC_SPACE;

  const afterIsWhitespace = isUnicodeWhitespace(charAfter);
  const afterIsPunct = isPunctuation(charAfter);
  const beforeIsWhitespace = isUnicodeWhitespace(charBefore);
  const beforeIsPunct = isPunctuation(charBefore);

  const leftFlanking = !afterIsWhitespace && (!afterIsPunct || beforeIsWhitespace || beforeIsPunct);

  const rightFlanking =
    !beforeIsWhitespace && (!beforeIsPunct || afterIsWhitespace || afterIsPunct);

  let canOpen: boolean;
  let canClose: boolean;

  if (ch === CC_UNDERSCORE) {
    canOpen = leftFlanking && (!rightFlanking || beforeIsPunct);
    canClose = rightFlanking && (!leftFlanking || afterIsPunct);
  } else {
    canOpen = leftFlanking;
    canClose = rightFlanking;
  }

  RESULT.count = count;
  RESULT.canOpen = canOpen;
  RESULT.canClose = canClose;
  return RESULT;
}
