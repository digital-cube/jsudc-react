import type { UrlStateAdapter } from "./adapter.js";

/**
 * `inner`, seen through a key prefix: `get()` returns only the parameters whose
 * name starts with `prefix`, with the prefix taken off, and `set()` rewrites
 * only those, leaving every other parameter of `inner` as it was. A data view
 * under it reads and writes `inbox.q`, `inbox.sort`, `inbox.board`, … while a
 * host's own `?q=` is neither read nor removed, and a second view with another
 * prefix keeps state of its own on the same page. End the prefix with a
 * separator (`inbox.`, `list-`): every key that starts with it is the view's.
 */
export function prefixUrlStateAdapter(inner: UrlStateAdapter, prefix: string): UrlStateAdapter {
  if (!prefix) throw new Error("prefixUrlStateAdapter: the prefix must not be empty");
  const own = (key: string) => key.startsWith(prefix);
  return {
    get() {
      const out = new URLSearchParams();
      for (const [key, value] of inner.get()) {
        if (own(key)) out.append(key.slice(prefix.length), value);
      }
      return out;
    },
    set(next, opts) {
      const out = new URLSearchParams();
      for (const [key, value] of inner.get()) if (!own(key)) out.append(key, value);
      for (const [key, value] of next) out.append(`${prefix}${key}`, value);
      inner.set(out, opts);
    },
    subscribe: (listener) => inner.subscribe(listener),
  };
}

/** A `UrlStateAdapter` that keeps the query string in memory, plus a way to inspect it. */
export interface MemoryUrlStateAdapter extends UrlStateAdapter {
  /** Every `set` so far, oldest first: what a push or a replace wrote (for tests and debugging). */
  readonly history: readonly string[];
}

/**
 * A query string that lives in memory only: the address bar is never read nor
 * written, and back / forward do not touch it. For a view whose state should
 * not survive a reload or be shared as a link (one pane of a host's screen).
 * Each call is a store of its own; `initial` seeds it.
 */
export function createMemoryUrlStateAdapter(
  initial?: string | URLSearchParams | Record<string, string>,
): MemoryUrlStateAdapter {
  let search = new URLSearchParams(initial ?? "").toString();
  const history: string[] = [];
  const listeners = new Set<() => void>();
  return {
    get: () => new URLSearchParams(search),
    set(next) {
      search = next.toString();
      history.push(search);
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    history,
  };
}
