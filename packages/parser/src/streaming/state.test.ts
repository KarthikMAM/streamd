/**
 * Unit tests for streaming state management.
 *
 * @module streaming/state.test
 */
import { describe, expect, it } from "vitest";
import { BlockKind } from "../scanner/block/types";
import { createInitialState, resetActiveState } from "./state";

describe("createInitialState", () => {
  it("should create state with correct defaults", () => {
    const opts = {
      math: false,
      strikethrough: false,
      autolinks: false,
      tables: false,
      taskListItems: false,
    };
    const state = createInitialState(100, opts);
    expect(state.prevLen).toBe(100);
    expect(state.opts).toBe(opts);
    expect(state.completedTokens.length).toBe(0);
    expect(state.activeBlockStart).toBe(0);
    expect(state.activeBlockKind).toBe(BlockKind.Paragraph);
    expect(state.activeContentStart).toBe(0);
    expect(state.activeFenceChar).toBe(0);
    expect(state.activeFenceLen).toBe(0);
    expect(state.activeLang).toBe("");
    expect(state.activeInfo).toBe("");
    expect(state.activeInlines).toBeNull();
  });
});

describe("resetActiveState", () => {
  it("should reset all active fields to defaults", () => {
    const opts = {
      math: false,
      strikethrough: false,
      autolinks: false,
      tables: false,
      taskListItems: false,
    };
    const state = createInitialState(100, opts);
    state.activeBlockKind = BlockKind.FencedCode;
    state.activeContentStart = 50;
    state.activeFenceChar = 0x60;
    state.activeFenceLen = 3;
    state.activeLang = "js";
    state.activeInfo = "js";
    state.activeInlines = [];

    resetActiveState(state);

    expect(state.activeBlockKind).toBe(BlockKind.Paragraph);
    expect(state.activeContentStart).toBe(0);
    expect(state.activeFenceChar).toBe(0);
    expect(state.activeFenceLen).toBe(0);
    expect(state.activeLang).toBe("");
    expect(state.activeInfo).toBe("");
    expect(state.activeInlines).toBeNull();
  });
});
