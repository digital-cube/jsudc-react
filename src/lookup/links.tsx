import type { FilterNode } from "@jsudc/core";
import { createContext, type MouseEvent, type ReactNode, useContext } from "react";
import { encodeFilterParam, PARAM } from "../data-view/urlState.js";

/**
 * How the library links from one collection to another (a lookup cell, a
 * `row_link`): the address of a collection's view, and how to go there
 * without a reload. The library knows no routes of its own, so the host says
 * where `<UdcDataView collection>` is mounted.
 */
export interface UdcLinks {
  /**
   * The address of `collection`'s view with `search` as its query string, or
   * `null` when the host has no view of `collection`: a lookup chip or label
   * to it is then plain text (a click on it falls through to the row), and a
   * `row_link` to it does nothing.
   */
  href(collection: string, search: URLSearchParams): string | null;
  /** Go to `href` inside the app. */
  navigate(href: string): void;
}

/**
 * `/c/<collection>?…`, followed with the History API: `pushState`, then a
 * `popstate` event, which a router on the History API (react-router's
 * `BrowserRouter` among them) reads as a navigation.
 */
export const defaultUdcLinks: UdcLinks = {
  href: (collection, search) => {
    const qs = search.toString();
    return `/c/${encodeURIComponent(collection)}${qs ? `?${qs}` : ""}`;
  },
  navigate: (href) => {
    window.history.pushState(null, "", href);
    window.dispatchEvent(new PopStateEvent("popstate"));
  },
};

const UdcLinksContext = createContext<UdcLinks>(defaultUdcLinks);

/** Links to other collections through `links`; without it, `defaultUdcLinks`. */
export function UdcLinksProvider({ links, children }: { links: UdcLinks; children?: ReactNode }) {
  return <UdcLinksContext.Provider value={links}>{children}</UdcLinksContext.Provider>;
}

export function useUdcLinks(): UdcLinks {
  return useContext(UdcLinksContext);
}

/**
 * The address of `collection` opened with `filter` as its filter tree (`?f=`);
 * `null` when the host has no view of `collection` (`UdcLinks.href`).
 */
export function filterHref(links: UdcLinks, collection: string, filter: FilterNode): string | null {
  const search = new URLSearchParams();
  const f = encodeFilterParam(filter);
  if (f) search.set(PARAM.filter, f);
  return links.href(collection, search);
}

/** A plain click navigates in the app; Cmd / Ctrl / Shift-click (and the middle button) open a new tab. */
export function followLink(
  e: Pick<MouseEvent, "metaKey" | "ctrlKey" | "shiftKey" | "button" | "preventDefault">,
  href: string,
  links: UdcLinks,
): void {
  e.preventDefault();
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) {
    window.open(href, "_blank", "noopener");
    return;
  }
  links.navigate(href);
}
