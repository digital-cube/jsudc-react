// Column sizing against the table's pane (0.6.0): a column's `width` is pixels or `fill`, a
// `fill` column takes what the pane has left after the fixed columns (never less than its
// `min_width`, several sharing it by `grow`), and `hide_below` drops a column while the pane is
// narrower than that. The keys are read loosely, so this works with `@jsudc/core` ^0.5.0, whose
// schema types `width` as a number and does not know the other three.
import { type RefObject, useLayoutEffect, useState } from "react";

/** The sizing keys of a column config, as they may arrive from any server. */
export interface ColumnSizing {
  width?: unknown;
  grow?: unknown;
  min_width?: unknown;
  hide_below?: unknown;
}

const positive = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined;

/** `width: fill`: the column takes the rest of the pane. */
export function isFillWidth(c: ColumnSizing): boolean {
  return c.width === "fill";
}

/**
 * Whether `hide_below` leaves the column out at this pane width. An unmeasured pane (`null`, or
 * 0 where nothing lays out) hides nothing, so the table renders as it did before a first measure.
 */
export function hiddenAtWidth(c: ColumnSizing, paneWidth: number | null): boolean {
  const below = positive(c.hide_below);
  return below !== undefined && paneWidth !== null && paneWidth > 0 && paneWidth < below;
}

export interface LayoutInput {
  id: string;
  config: ColumnSizing;
}

export interface LayoutOptions {
  /** The pane's inner width in px (`clientWidth` of the scroll box); `null` before a measure. */
  paneWidth: number | null;
  /** Width taken by columns that are not view columns (checkbox, actions, add-column). */
  reserved: number;
  /** The view's `default_column_width`: a column without a width, and a fill column's floor. */
  defaultWidth: number;
}

/**
 * The width in whole px of every column. A fixed column gets its `width` (else the default). The
 * pane's free width is shared among the `fill` columns by `grow`; one whose share would be under
 * its `min_width` gets the floor and the rest is shared again among the others. Without a
 * measured pane a fill column is its floor. Shares are rounded down, so the columns never add up
 * to more than the pane and no sideways scrollbar appears for a fraction of a pixel.
 */
export function layoutColumnWidths(
  columns: readonly LayoutInput[],
  opts: LayoutOptions,
): Record<string, number> {
  const out: Record<string, number> = {};
  const fills: { id: string; grow: number; min: number }[] = [];
  let fixed = 0;
  for (const c of columns) {
    if (isFillWidth(c.config)) {
      fills.push({
        id: c.id,
        grow: positive(c.config.grow) ?? 1,
        min: positive(c.config.min_width) ?? opts.defaultWidth,
      });
      continue;
    }
    const w = positive(c.config.width) ?? opts.defaultWidth;
    out[c.id] = w;
    fixed += w;
  }
  if (fills.length === 0) return out;

  let free = opts.paneWidth && opts.paneWidth > 0 ? opts.paneWidth - opts.reserved - fixed : 0;
  let open = fills;
  // Water-filling: pin each column whose share falls under its floor, then share the rest again.
  for (;;) {
    const grow = open.reduce((sum, f) => sum + f.grow, 0);
    const clamped = open.filter((f) => (free * f.grow) / grow < f.min);
    if (clamped.length === 0) {
      for (const f of open) out[f.id] = Math.max(f.min, Math.floor((free * f.grow) / grow));
      break;
    }
    for (const f of clamped) {
      out[f.id] = f.min;
      free -= f.min;
    }
    open = open.filter((f) => !clamped.includes(f));
    if (open.length === 0) break;
  }
  return out;
}

/**
 * The inner width of the table's pane (`clientWidth` of the element: no border, no vertical
 * scrollbar), kept current by a ResizeObserver. `null` until measured, and where there is no
 * ResizeObserver or the element has no layout (0, as in jsdom). Off: no observer, `null`.
 */
export function usePaneWidth(ref: RefObject<HTMLElement | null>, on: boolean): number | null {
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!on || !el) {
      setWidth(null);
      return;
    }
    const measure = () => {
      const w = el.clientWidth;
      setWidth(w > 0 ? w : null);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, on]);
  return width;
}
