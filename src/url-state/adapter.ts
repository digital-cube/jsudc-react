/**
 * Where the data view keeps what the user chose (filters, sort, page, the
 * kanban board, the chart and calendar windows): the query string of the
 * address bar, behind three calls so the library needs no router. A host on
 * a router passes an adapter over it (the package ships one on a subpath);
 * without one the History API is used directly.
 */
export interface UrlStateAdapter {
  /** The query string as it is now. Called during render and before every update. */
  get(): URLSearchParams;
  /** Write the whole query string; `replace` rewrites the current history entry. */
  set(next: URLSearchParams, opts?: { replace?: boolean }): void;
  /** Call `listener` when the query string changed by other means (back, forward). */
  subscribe(listener: () => void): () => void;
}

const listeners = new Set<() => void>();
const emit = () => {
  for (const listener of listeners) listener();
};

/**
 * The default adapter: `window.location.search`, written with
 * `history.pushState` / `replaceState`, read again on `popstate`. The path
 * and the hash stay as they are; a replace keeps `history.state`, so a
 * router that keys its entries there is not confused.
 */
export const windowLocationAdapter: UrlStateAdapter = {
  get: () => new URLSearchParams(typeof window === "undefined" ? "" : window.location.search),
  set(next, opts) {
    const qs = next.toString();
    const { pathname, hash } = window.location;
    const url = `${pathname}${qs ? `?${qs}` : ""}${hash}`;
    if (opts?.replace) window.history.replaceState(window.history.state, "", url);
    else window.history.pushState(null, "", url);
    emit();
  },
  subscribe(listener) {
    if (listeners.size === 0) window.addEventListener("popstate", emit);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) window.removeEventListener("popstate", emit);
    };
  },
};
