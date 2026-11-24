import { type ReactNode, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { type UdcLinks, UdcLinksProvider } from "../lookup/links.js";
import type { UrlStateAdapter } from "../url-state/adapter.js";
import { UdcUrlStateProvider } from "../url-state/UrlState.js";

const noSubscription = () => () => {};

/**
 * Mount inside a react-router router (`BrowserRouter`, `MemoryRouter`, a data
 * router) to keep the data view's URL state in the router's location. The
 * adapter is rebuilt when the router's query string changes, which re-renders
 * the hooks under it in the router's own render; nothing to subscribe to.
 */
export function UdcReactRouterUrlState({
  children,
  collectionPath,
}: {
  children?: ReactNode;
  /**
   * The route of a collection's view, e.g. `` (c) => `/udc/${c}` ``. With it, lookup
   * links and `row_link`s go there through the router's `navigate`; `null` for a
   * collection with no view in the app makes its lookup chips plain text.
   */
  collectionPath?: (collection: string) => string | null;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const links = useMemo<UdcLinks | null>(
    () =>
      collectionPath
        ? {
            href: (collection, search) => {
              const path = collectionPath(collection);
              if (path === null) return null;
              const qs = search.toString();
              return `${path}${qs ? `?${qs}` : ""}`;
            },
            navigate: (href) => void navigate(href),
          }
        : null,
    [collectionPath, navigate],
  );
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
  const inner = <UdcUrlStateProvider adapter={adapter}>{children}</UdcUrlStateProvider>;
  return links ? <UdcLinksProvider links={links}>{inner}</UdcLinksProvider> : inner;
}
