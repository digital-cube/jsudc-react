// Can this device hover (0.8.1)? What turns the `hover` row actions display into `menu` on a
// touch screen, where nothing would ever reveal the bar. No JSX (`@jsudc/react/headless`).
import { useSyncExternalStore } from "react";

const NO_HOVER = "(hover: none)";

function query(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(NO_HOVER);
}

function subscribe(onChange: () => void): () => void {
  const mql = query();
  if (!mql) return () => {};
  // Safari before 14 has only the deprecated addListener.
  if (typeof mql.addEventListener === "function") {
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }
  mql.addListener(onChange);
  return () => mql.removeListener(onChange);
}

const canHoverNow = () => !(query()?.matches ?? false);
const canHoverOnServer = () => true;

/**
 * `false` while the primary pointer cannot hover (`@media (hover: none)`: a
 * touch screen), `true` otherwise. Without `window.matchMedia` (SSR, jsdom)
 * it answers `true`: the device is taken to hover.
 */
export function useCanHover(): boolean {
  return useSyncExternalStore(subscribe, canHoverNow, canHoverOnServer);
}

/**
 * The display a renderer draws: `hover` becomes `menu` on a device that cannot
 * hover; `inline` and `menu` stay as they are.
 */
export function effectiveRowActionsDisplay<D extends string>(display: D, canHover: boolean): D {
  return (display === "hover" && !canHover ? "menu" : display) as D;
}
