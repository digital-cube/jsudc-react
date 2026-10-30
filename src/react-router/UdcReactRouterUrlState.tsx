import { type ReactNode, useMemo, useRef } from "react";
import { useSearchParams } from "react-router";
import type { UrlStateAdapter } from "../url-state/adapter";
import { UdcUrlStateProvider } from "../url-state/UrlState";

const noSubscription = () => () => {};

/**
 * Mount inside a react-router router (`BrowserRouter`, `MemoryRouter`, a data
 * router) to keep the data view's URL state in the router's location. The
 * adapter is rebuilt when the router's query string changes, which re-renders
 * the hooks under it in the router's own render; nothing to subscribe to.
 */
export function UdcReactRouterUrlState({ children }: { children?: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.toString();
  // What the last `set` wrote, until the router renders it: a second update in the
  // same transition starts from the first one's result, as with `window.location`.
  const latest = useRef(search);
  const adapter = useMemo<UrlStateAdapter>(() => {
    latest.current = search;
    return {
      get: () => new URLSearchParams(latest.current),
      set(next, opts) {
        latest.current = next.toString();
        setSearchParams(next, { replace: opts?.replace });
      },
      subscribe: noSubscription,
    };
  }, [search, setSearchParams]);
  return <UdcUrlStateProvider adapter={adapter}>{children}</UdcUrlStateProvider>;
}
