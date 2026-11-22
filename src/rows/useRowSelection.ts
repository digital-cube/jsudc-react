// Row selection over a list (0.5.0): a set of ids, or "every row that matches this filter,
// except these ids". The model is plain data with pure operations (so a virtualised list,
// which draws only some rows, ranges over the rows as loaded, not over the DOM), and
// `useRowSelection` keeps one for a list, clearing it when the list's key (collection and
// filter) changes. The data view uses it; a host renderer gets the same from
// `@jsudc/react/headless` through `RendererProps.selection`. No JSX.
import type { Row } from "@jsudc/core";
import { useCallback, useMemo, useRef, useState } from "react";

/**
 * What is selected. `ids`: exactly these rows. `matching`: every row the
 * list's filter matches, loaded or not, except `except`. `anchor` is the row a
 * shift-range starts from (the last one toggled), `null` for none.
 */
export type RowSelectionState =
  | { mode: "ids"; ids: ReadonlySet<string>; anchor: string | null }
  | { mode: "matching"; except: ReadonlySet<string>; anchor: string | null };

/** Nothing selected. */
export const EMPTY_SELECTION: RowSelectionState = Object.freeze({
  mode: "ids",
  ids: new Set<string>(),
  anchor: null,
}) as RowSelectionState;

const idOf = (r: Row) => r.__meta.id;

/** Is the row `id` selected? */
export function selectionHas(s: RowSelectionState, id: string): boolean {
  return s.mode === "ids" ? s.ids.has(id) : !s.except.has(id);
}

/** Nothing selected: no id in id mode (matching mode always counts as something). */
export function selectionIsEmpty(s: RowSelectionState): boolean {
  return s.mode === "ids" && s.ids.size === 0;
}

/**
 * How many rows are selected: the ids in id mode; in matching mode `total`
 * minus the exceptions, or `null` when the list has no total (a source with
 * `capabilities.total_count: false`).
 */
export function selectionCount(s: RowSelectionState, total: number | null): number | null {
  if (s.mode === "ids") return s.ids.size;
  return total === null ? null : Math.max(0, total - s.except.size);
}

/** Set (`on`) or unset each of `ids`, keeping the mode. */
function setMany(
  s: RowSelectionState,
  ids: readonly string[],
  on: boolean,
  anchor: string | null,
): RowSelectionState {
  if (s.mode === "ids") {
    const next = new Set(s.ids);
    for (const id of ids) on ? next.add(id) : next.delete(id);
    return { mode: "ids", ids: next, anchor };
  }
  const except = new Set(s.except);
  for (const id of ids) on ? except.delete(id) : except.add(id);
  return { mode: "matching", except, anchor };
}

/** Flip one row; it becomes the anchor of the next range. */
export function toggleSelection(s: RowSelectionState, id: string): RowSelectionState {
  return setMany(s, [id], !selectionHas(s, id), id);
}

/**
 * Shift-click on `id`: every row from the anchor to `id`, in the order of
 * `rows` (the rows as loaded), takes the state the anchor has. Without an
 * anchor among `rows` it is a plain toggle. The anchor stays where it was, so
 * a second shift-click re-ranges from the same row.
 */
export function selectRange(
  s: RowSelectionState,
  rows: readonly Row[],
  id: string,
): RowSelectionState {
  const from = s.anchor === null ? -1 : rows.findIndex((r) => idOf(r) === s.anchor);
  const to = rows.findIndex((r) => idOf(r) === id);
  if (from < 0 || to < 0) return toggleSelection(s, id);
  const [lo, hi] = from <= to ? [from, to] : [to, from];
  const ids = rows.slice(lo, hi + 1).map(idOf);
  return setMany(s, ids, selectionHas(s, s.anchor as string), s.anchor);
}

/** Every loaded row selected (`on`) or none of them. */
export function setPageSelection(
  s: RowSelectionState,
  rows: readonly Row[],
  on: boolean,
): RowSelectionState {
  return setMany(s, rows.map(idOf), on, s.anchor);
}

/** Every row that matches the list's filter, loaded or not. */
export function selectAllMatching(): RowSelectionState {
  return { mode: "matching", except: new Set(), anchor: null };
}

/** How much of the loaded rows is selected: `none`, `some` or `all` (no rows: `none`). */
export function pageSelectionState(
  s: RowSelectionState,
  rows: readonly Row[],
): "none" | "some" | "all" {
  let on = 0;
  for (const r of rows) if (selectionHas(s, idOf(r))) on++;
  if (on === 0) return "none";
  return on === rows.length ? "all" : "some";
}

/**
 * The live selection of one list: its state, what follows from it, and the
 * operations. What `RendererProps.selection` carries.
 */
export interface RowSelection {
  /** `ids`: the rows in `ids`. `matching`: every row of the filter except `exceptIds`. */
  mode: "ids" | "matching";
  /** The selected ids (id mode; empty in matching mode). */
  ids: readonly string[];
  /** The ids taken out of an "all that match" selection (matching mode; empty in id mode). */
  exceptIds: readonly string[];
  /** How many rows are selected; `null` in matching mode when the list has no total. */
  count: number | null;
  /** Nothing is selected. */
  isEmpty: boolean;
  /**
   * The selected rows the list has loaded, in id mode also those loaded
   * earlier and no longer in the list (kept from when they were selected).
   */
  rows: readonly Row[];
  /** How much of the loaded rows is selected, for a header checkbox. */
  pageState: "none" | "some" | "all";
  isSelected: (id: string) => boolean;
  /** Flip one row; with `range` (shift-click) select from the last toggled row to this one. */
  toggle: (id: string, opts?: { range?: boolean }) => void;
  /** Select (`true`) or clear (`false`) every loaded row. */
  setPage: (on: boolean) => void;
  /** Select every row that matches the filter, loaded or not. */
  selectAllMatching: () => void;
  /** Keep exactly these ids selected (id mode). */
  setIds: (ids: readonly string[]) => void;
  /** Select nothing. */
  clear: () => void;
}

export interface UseRowSelectionOptions {
  /** The loaded rows, in the order they are drawn: what a range and "the page" cover. */
  rows: readonly Row[];
  /** The list's total; `null` when the source does not count. */
  total: number | null;
  /**
   * Changes when the selection no longer applies: the collection or the
   * filter (search, chips, the filter tree, the host's filter). A sort, a
   * refetch or another page loading keep the key, and the selection.
   */
  resetKey: string;
}

/** One list's selection, cleared whenever `resetKey` changes. */
export function useRowSelection({ rows, total, resetKey }: UseRowSelectionOptions): RowSelection {
  const [held, setHeld] = useState<{ key: string; state: RowSelectionState }>({
    key: resetKey,
    state: EMPTY_SELECTION,
  });
  // A new key reads as empty at once (no effect, no frame with a stale selection).
  const state = held.key === resetKey ? held.state : EMPTY_SELECTION;
  const latest = useRef({ rows, resetKey });
  latest.current = { rows, resetKey };
  // Rows selected while loaded, so `rows` still names them after a refetch drops them.
  const known = useRef(new Map<string, Row>());
  for (const r of rows) if (known.current.has(idOf(r))) known.current.set(idOf(r), r);

  const update = useCallback(
    (f: (s: RowSelectionState, rows: readonly Row[]) => RowSelectionState) => {
      const { rows: now, resetKey: key } = latest.current;
      setHeld((h) => ({ key, state: f(h.key === key ? h.state : EMPTY_SELECTION, now) }));
    },
    [],
  );

  const toggle = useCallback(
    (id: string, opts?: { range?: boolean }) =>
      update((s, now) => (opts?.range ? selectRange(s, now, id) : toggleSelection(s, id))),
    [update],
  );
  const setPage = useCallback(
    (on: boolean) => update((s, now) => setPageSelection(s, now, on)),
    [update],
  );
  const selectAll = useCallback(() => update(() => selectAllMatching()), [update]);
  const setIds = useCallback(
    (ids: readonly string[]) => update(() => ({ mode: "ids", ids: new Set(ids), anchor: null })),
    [update],
  );
  const clear = useCallback(() => update(() => EMPTY_SELECTION), [update]);

  return useMemo(() => {
    const byId = new Map(rows.map((r) => [idOf(r), r] as const));
    let selectedRows: Row[];
    if (state.mode === "ids") {
      selectedRows = [];
      for (const id of state.ids) {
        const r = byId.get(id) ?? known.current.get(id);
        if (r) selectedRows.push(r);
      }
    } else {
      selectedRows = rows.filter((r) => !state.except.has(idOf(r)));
    }
    // Remember what is selected now; forget what is not.
    const keep = new Map<string, Row>();
    for (const r of selectedRows) keep.set(idOf(r), r);
    known.current = keep;
    return {
      mode: state.mode,
      ids: state.mode === "ids" ? [...state.ids] : [],
      exceptIds: state.mode === "matching" ? [...state.except] : [],
      count: selectionCount(state, total),
      isEmpty: selectionIsEmpty(state),
      rows: selectedRows,
      pageState: pageSelectionState(state, rows),
      isSelected: (id: string) => selectionHas(state, id),
      toggle,
      setPage,
      selectAllMatching: selectAll,
      setIds,
      clear,
    };
  }, [state, rows, total, toggle, setPage, selectAll, setIds, clear]);
}
