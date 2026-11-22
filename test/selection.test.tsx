// Row selection (0.5.0, R1 + S3): the headless model and useRowSelection.
import type { Row } from "@jsudc/core";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  bulkActionEligible,
  EMPTY_SELECTION,
  MATCH_ALL,
  pageSelectionState,
  planBulkAction,
  selectAllMatching,
  selectionCount,
  selectionHas,
  selectionIsEmpty,
  selectionTarget,
  selectRange,
  setPageSelection,
  toggleSelection,
  useRowSelection,
} from "../src/headless";
import { row } from "./fetchMock";

const ROWS: Row[] = ["a", "b", "c", "d", "e"].map((id) => row(id, 1, { n: id }));

describe("the selection model", () => {
  it("toggles one row and makes it the anchor", () => {
    const s = toggleSelection(EMPTY_SELECTION, "b");
    expect(selectionHas(s, "b")).toBe(true);
    expect(s.anchor).toBe("b");
    expect(selectionHas(toggleSelection(s, "b"), "b")).toBe(false);
  });

  it("selects a range over the rows as loaded, from the anchor, either direction", () => {
    const down = selectRange(toggleSelection(EMPTY_SELECTION, "b"), ROWS, "d");
    expect(ROWS.filter((r) => selectionHas(down, r.__meta.id)).map((r) => r.__meta.id)).toEqual([
      "b",
      "c",
      "d",
    ]);
    const up = selectRange(toggleSelection(EMPTY_SELECTION, "d"), ROWS, "a");
    expect(selectionCount(up, null)).toBe(4);
    // A range from an unchecked anchor clears.
    const all = setPageSelection(EMPTY_SELECTION, ROWS, true);
    const cleared = selectRange(toggleSelection(all, "b"), ROWS, "d");
    expect(ROWS.filter((r) => selectionHas(cleared, r.__meta.id)).map((r) => r.__meta.id)).toEqual([
      "a",
      "e",
    ]);
  });

  it("without an anchor a range is a plain toggle", () => {
    const s = selectRange(EMPTY_SELECTION, ROWS, "c");
    expect(selectionCount(s, null)).toBe(1);
  });

  it("selects and clears the page, and reads none / some / all", () => {
    expect(pageSelectionState(EMPTY_SELECTION, ROWS)).toBe("none");
    const one = toggleSelection(EMPTY_SELECTION, "a");
    expect(pageSelectionState(one, ROWS)).toBe("some");
    const page = setPageSelection(one, ROWS, true);
    expect(pageSelectionState(page, ROWS)).toBe("all");
    expect(selectionIsEmpty(setPageSelection(page, ROWS, false))).toBe(true);
  });

  it("all that match: everything except the rows taken out, counted from the total", () => {
    const all = selectAllMatching();
    expect(selectionIsEmpty(all)).toBe(false);
    expect(selectionHas(all, "zz-not-loaded")).toBe(true);
    const less = toggleSelection(all, "c");
    expect(selectionHas(less, "c")).toBe(false);
    expect(selectionCount(less, 120)).toBe(119);
    // No total: no count.
    expect(selectionCount(less, null)).toBeNull();
    expect(pageSelectionState(less, ROWS)).toBe("some");
  });
});

describe("selectionTarget and planBulkAction", () => {
  it("sends ids in id mode, the filter with except_ids in match mode", () => {
    expect(selectionTarget({ mode: "ids", ids: ["a"], exceptIds: [] }, undefined)).toEqual({
      ids: ["a"],
    });
    const f = { field: "folder", op: "eq" as const, value: "inbox" };
    expect(selectionTarget({ mode: "matching", ids: [], exceptIds: ["b"] }, f)).toEqual({
      filter: f,
      except_ids: ["b"],
    });
    expect(selectionTarget({ mode: "matching", ids: [], exceptIds: [] }, undefined)).toEqual({
      filter: MATCH_ALL,
    });
  });

  it("a handler wins, then delete, then set, then the named server action", () => {
    const h = () => {};
    expect(planBulkAction({ kind: "archive" }, undefined, { archive: h }).via).toBe("host");
    expect(planBulkAction({ kind: "archive" }, { archive: h }, undefined).via).toBe("host");
    expect(planBulkAction({ kind: "delete" })).toEqual({ via: "delete" });
    expect(planBulkAction({ kind: "mark_read", set: { read: true } })).toEqual({
      via: "set",
      patch: { read: true },
    });
    expect(planBulkAction({ kind: "snooze", action: "mail.snooze" })).toEqual({
      via: "server",
      action: "mail.snooze",
    });
    expect(planBulkAction({ kind: "snooze" })).toEqual({ via: "server", action: "snooze" });
    // An inherited key is no handler.
    expect(planBulkAction({ kind: "toString" }, {}).via).toBe("server");
  });

  it("eligibility: every selected row in id mode; unless `when: false` in match mode", () => {
    const def = { kind: "x", when: { field: "read", op: "eq" as const, value: false } };
    const unread = row("u", 1, { read: false });
    const read = row("r", 1, { read: true });
    expect(bulkActionEligible(def, { mode: "ids", rows: [unread] })).toBe(true);
    expect(bulkActionEligible(def, { mode: "ids", rows: [unread, read] })).toBe(false);
    expect(bulkActionEligible(def, { mode: "matching", rows: [read] })).toBe(true);
    expect(bulkActionEligible({ kind: "x", when: false }, { mode: "matching", rows: [] })).toBe(
      false,
    );
  });
});

describe("useRowSelection", () => {
  const setup = (initial: { rows: Row[]; total: number | null; resetKey: string }) =>
    renderHook((p) => useRowSelection(p), { initialProps: initial });

  it("toggle, range, page and all-matching through the hook", () => {
    const { result } = setup({ rows: ROWS, total: 40, resetKey: "k" });
    act(() => result.current.toggle("a"));
    act(() => result.current.toggle("c", { range: true }));
    expect(result.current.ids).toEqual(["a", "b", "c"]);
    expect(result.current.rows.map((r) => r.__meta.id)).toEqual(["a", "b", "c"]);
    expect(result.current.pageState).toBe("some");
    act(() => result.current.setPage(true));
    expect(result.current.pageState).toBe("all");
    expect(result.current.count).toBe(5);
    act(() => result.current.selectAllMatching());
    expect(result.current.mode).toBe("matching");
    expect(result.current.count).toBe(40);
    act(() => result.current.toggle("e"));
    expect(result.current.exceptIds).toEqual(["e"]);
    expect(result.current.count).toBe(39);
    act(() => result.current.clear());
    expect(result.current.isEmpty).toBe(true);
  });

  it("is cleared by a new key (filter, collection) and kept by new rows (sort, refetch, a page)", () => {
    const { result, rerender } = setup({ rows: ROWS, total: 5, resetKey: "k1" });
    act(() => result.current.toggle("b"));
    // A sort or refetch: other rows, other order, same key.
    const resorted = [...ROWS].reverse();
    rerender({ rows: resorted, total: 5, resetKey: "k1" });
    expect(result.current.ids).toEqual(["b"]);
    // A refetch without the row: still selected, still known.
    rerender({ rows: ROWS.filter((r) => r.__meta.id !== "b"), total: 4, resetKey: "k1" });
    expect(result.current.ids).toEqual(["b"]);
    expect(result.current.rows.map((r) => r.__meta.id)).toEqual(["b"]);
    // The filter changed.
    rerender({ rows: ROWS, total: 5, resetKey: "k2" });
    expect(result.current.isEmpty).toBe(true);
  });

  it("setIds keeps exactly the given ids", () => {
    const { result } = setup({ rows: ROWS, total: 5, resetKey: "k" });
    act(() => result.current.setPage(true));
    act(() => result.current.setIds(["d"]));
    expect(result.current.ids).toEqual(["d"]);
    expect(result.current.mode).toBe("ids");
  });
});
