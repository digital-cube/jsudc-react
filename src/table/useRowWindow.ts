// Long lists (0.5.0): the table's infinite mode mounts only the rows near the viewport. Rows
// have one height (the view's `row_height`), so the window is arithmetic: no measuring of
// each row, no dependency. The rows outside it are two (or more) spacer rows whose height is
// that of the rows they stand for, so the scrollbar and the scroll position are those of the
// whole list. No JSX.
import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PagingMode } from "../udc/keys.js";

/**
 * When and how the table's infinite mode windows its rows (`UdcDataView virtualize`,
 * `TableRenderer virtualize`). Every field is optional.
 */
export interface TableVirtualization {
  /**
   * `"auto"` (default): windowed once more than `threshold` rows are loaded.
   * `true`: always windowed in infinite mode. `false`: never.
   * Pages mode is never windowed.
   */
  enabled?: boolean | "auto" | undefined;
  /** The loaded-row count above which `"auto"` windows. Default 200. */
  threshold?: number | undefined;
  /** Rows mounted beyond each edge of the viewport. Default 10. */
  overscan?: number | undefined;
}

/** `virtualize` as a prop: `true` / `false` are shorthand for `{ enabled }`. */
export type TableVirtualizeProp = boolean | TableVirtualization;

export const DEFAULT_VIRTUAL_THRESHOLD = 200;
export const DEFAULT_VIRTUAL_OVERSCAN = 10;

/** Every field of `virtualize` resolved against the defaults. */
export function resolveVirtualization(v: TableVirtualizeProp | undefined): {
  enabled: boolean | "auto";
  threshold: number;
  overscan: number;
} {
  const o: TableVirtualization = typeof v === "boolean" ? { enabled: v } : (v ?? {});
  const num = (n: number | undefined, d: number) =>
    typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : d;
  return {
    enabled: o.enabled ?? "auto",
    threshold: num(o.threshold, DEFAULT_VIRTUAL_THRESHOLD),
    overscan: num(o.overscan, DEFAULT_VIRTUAL_OVERSCAN),
  };
}

/** Does a table in `mode` with `count` loaded rows window them? */
export function virtualizationApplies(
  v: TableVirtualizeProp | undefined,
  mode: PagingMode,
  count: number,
): boolean {
  if (mode !== "infinite") return false;
  const { enabled, threshold } = resolveVirtualization(v);
  if (enabled === "auto") return count > threshold;
  return enabled;
}

/** The mounted rows `[start, end)` of a list. */
export interface RowRange {
  start: number;
  end: number;
}

/**
 * The rows that show in a viewport of `viewport` px scrolled to `scrollTop`, the body's rows
 * starting under a sticky header of `headerHeight` px: `[start, end)`, clamped to `count`.
 */
export function visibleRange(
  scrollTop: number,
  viewport: number,
  headerHeight: number,
  rowHeight: number,
  count: number,
): RowRange {
  const h = Math.max(1, rowHeight);
  const start = Math.max(0, Math.min(count, Math.floor(Math.max(0, scrollTop) / h)));
  const end = Math.max(
    start,
    Math.min(count, Math.ceil((Math.max(0, scrollTop) + viewport - headerHeight) / h)),
  );
  return { start, end };
}

/** `visible` widened by `overscan` rows on each side, clamped to `count`. */
export function withOverscan(visible: RowRange, overscan: number, count: number): RowRange {
  return {
    start: Math.max(0, visible.start - overscan),
    end: Math.min(count, visible.end + overscan),
  };
}

/**
 * Keep `current` while the visible rows stay at least half the overscan inside it (or it
 * reaches the list's edge there): a scroll of a row or two re-renders nothing.
 */
export function keepRange(
  current: RowRange,
  visible: RowRange,
  overscan: number,
  count: number,
): boolean {
  if (current.end > count) return false;
  const margin = Math.ceil(overscan / 2);
  const topOk = current.start === 0 ? visible.start >= 0 : visible.start - current.start >= margin;
  const bottomOk =
    current.end === count ? visible.end <= count : current.end - visible.end >= margin;
  return topOk && bottomOk && visible.start >= current.start && visible.end <= current.end;
}

/** One piece of a windowed body: a run of mounted rows, or a spacer standing for `rows` rows. */
export type BodySlice =
  | { kind: "rows"; from: number; to: number }
  | { kind: "gap"; from: number; rows: number };

/**
 * The body of `count` rows with `range` mounted, plus the `pinned` indexes (a row with an
 * open editor, the focused row, …) mounted where they belong, and spacers between.
 */
export function bodySlices(count: number, range: RowRange, pinned: readonly number[]): BodySlice[] {
  const keep = new Set<number>();
  for (const i of pinned)
    if (i >= 0 && i < count && (i < range.start || i >= range.end)) keep.add(i);
  const runs: { from: number; to: number }[] = [...keep].map((i) => ({ from: i, to: i + 1 }));
  if (range.end > range.start) runs.push({ from: range.start, to: Math.min(count, range.end) });
  runs.sort((a, b) => a.from - b.from);
  const out: BodySlice[] = [];
  let at = 0;
  for (const r of runs) {
    if (r.from > at) out.push({ kind: "gap", from: at, rows: r.from - at });
    const last = out[out.length - 1];
    if (last?.kind === "rows" && last.to === r.from) last.to = r.to;
    else out.push({ kind: "rows", from: r.from, to: r.to });
    at = r.to;
  }
  if (at < count) out.push({ kind: "gap", from: at, rows: count - at });
  return out;
}

/** Where the scrolled element stands, read from the DOM. */
interface Metrics {
  scrollTop: number;
  viewport: number;
  headerHeight: number;
}

/** A viewport not laid out (a test DOM, a hidden tab) still mounts a screenful. */
const FALLBACK_VIEWPORT = 800;

function readMetrics(el: HTMLElement | null, header: HTMLElement | null): Metrics {
  if (!el) return { scrollTop: 0, viewport: FALLBACK_VIEWPORT, headerHeight: 0 };
  const viewport =
    el.clientHeight > 0
      ? el.clientHeight
      : typeof window !== "undefined" && window.innerHeight > 0
        ? window.innerHeight
        : FALLBACK_VIEWPORT;
  return { scrollTop: el.scrollTop, viewport, headerHeight: header?.offsetHeight ?? 0 };
}

export interface UseRowWindowOptions {
  /** Windowed at all; off, the range is every row. */
  on: boolean;
  count: number;
  rowHeight: number;
  overscan: number;
  /** The scrolled element (`overflow: auto`). */
  scrollRef: RefObject<HTMLElement | null>;
  /** The sticky header over the rows, whose height hides the rows under it. */
  headerRef: RefObject<HTMLElement | null>;
}

export interface RowWindow {
  /** The mounted rows; `{ 0, count }` when off. */
  range: RowRange;
  /** Call from the scrolled element's `onScroll`. */
  onScroll: () => void;
  /** Scroll so row `index` shows (the nearest edge, as `scrollIntoView({ block: "nearest" })`) and mount it. */
  scrollToIndex: (index: number) => void;
}

export function useRowWindow(options: UseRowWindowOptions): RowWindow {
  const { on, count, rowHeight, overscan, scrollRef, headerRef } = options;
  const [range, setRange] = useState<RowRange>(() =>
    withOverscan(visibleRange(0, FALLBACK_VIEWPORT, 0, rowHeight, count), overscan, count),
  );
  const latest = useRef({ count, rowHeight, overscan, range });
  latest.current = { count, rowHeight, overscan, range };

  const update = useCallback(
    (force: boolean) => {
      const now = latest.current;
      const m = readMetrics(scrollRef.current, headerRef.current);
      const visible = visibleRange(
        m.scrollTop,
        m.viewport,
        m.headerHeight,
        now.rowHeight,
        now.count,
      );
      if (!force && keepRange(now.range, visible, now.overscan, now.count)) return;
      const next = withOverscan(visible, now.overscan, now.count);
      if (next.start === now.range.start && next.end === now.range.end) return;
      latest.current.range = next;
      setRange(next);
    },
    [scrollRef, headerRef],
  );

  // A new count, row height or overscan, or windowing just turned on: place the window again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: these are the triggers
  useLayoutEffect(() => {
    if (on) update(true);
  }, [on, count, rowHeight, overscan, update]);

  // The viewport resized (the window, a split pane): more or fewer rows show.
  useEffect(() => {
    const el = scrollRef.current;
    if (!on || !el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => update(false));
    ro.observe(el);
    return () => ro.disconnect();
  }, [on, scrollRef, update]);

  const onScroll = useCallback(() => {
    if (on) update(false);
  }, [on, update]);

  const scrollToIndex = useCallback(
    (index: number) => {
      const el = scrollRef.current;
      if (!el) return;
      const { rowHeight: h } = latest.current;
      const m = readMetrics(el, headerRef.current);
      const top = index * h;
      const bottom = m.headerHeight + (index + 1) * h;
      if (top < el.scrollTop) el.scrollTop = top;
      else if (bottom > el.scrollTop + m.viewport) el.scrollTop = bottom - m.viewport;
      if (on) update(false);
    },
    [on, scrollRef, headerRef, update],
  );

  return {
    range: on ? range : { start: 0, end: count },
    onScroll,
    scrollToIndex,
  };
}
