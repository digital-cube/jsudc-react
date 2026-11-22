import type { ListResponse, Row } from "@jsudc/core";
import type { InfiniteData } from "@tanstack/react-query";

/** What a list query caches: one page (`useQuery`) or the pages of an infinite list. */
export type ListCache = ListResponse | InfiniteData<ListResponse, unknown>;

export function isInfinite(data: ListCache): data is InfiniteData<ListResponse, unknown> {
  return "pages" in data;
}

/**
 * `data` with every row `touches` picks patched (`patch` given) or removed
 * (`patch` absent; each page's `total` goes down by the rows removed from the
 * whole list).
 */
export function applyToListRows(
  data: ListCache | undefined,
  touches: (row: Row) => boolean,
  patch?: (row: Row) => Row,
): ListCache | undefined {
  if (!data) return data;
  const pages = isInfinite(data) ? data.pages : [data];
  let removed = 0;
  const next = pages.map((page) => {
    if (!page.rows.some(touches)) return page;
    if (patch) return { ...page, rows: page.rows.map((r) => (touches(r) ? patch(r) : r)) };
    const rows = page.rows.filter((r) => !touches(r));
    removed += page.rows.length - rows.length;
    return { ...page, rows };
  });
  const counted =
    removed === 0
      ? next
      : next.map((p) => (p.total === null ? p : { ...p, total: Math.max(0, p.total - removed) }));
  return isInfinite(data) ? { ...data, pages: counted } : (counted[0] as ListResponse);
}
