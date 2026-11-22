import type { UdcClient } from "@jsudc/core/client";
import type { ReactNode } from "react";
import { type BulkActionHandlers, UdcActionsProvider } from "../actions/bulk.js";
import { type CellRegistry, UdcCellsProvider } from "../cells/registry.js";
import { type UdcLinks, UdcLinksProvider } from "../lookup/links.js";
import { UdcRenderersProvider } from "../renderers/context.js";
import type { RendererRegistry } from "../renderers/types.js";
import { UdcUiProvider } from "../ui-kit/context.js";
import type { UiKit } from "../ui-kit/types.js";
import { UdcClientContext } from "./client.js";

export {
  createUdcQueryClient,
  shouldRetry,
  type UdcQueryClientOptions,
  useUdcClient,
} from "./client.js";

/**
 * The root provider: the client, the renderers `UdcDataView` draws its tabs
 * with, and optionally the UI kit they draw with. Without `kit` the kit in
 * effect is kept (an outer `UdcUiProvider`'s, else `defaultUiKit`); without
 * `renderers` the outer `UdcRenderersProvider`'s registry is kept (else none:
 * every tab says no renderer is registered).
 */
export function UdcProvider({
  client,
  kit,
  renderers,
  links,
  cells,
  actions,
  children,
}: {
  client: UdcClient;
  /**
   * Where a lookup link and a `row_link` go: the address of a collection's
   * view, and how to navigate there. Default `defaultUdcLinks` (`/c/<name>`);
   * `UdcReactRouterUrlState collectionPath` sets it for react-router.
   */
  links?: UdcLinks;
  kit?: UiKit;
  /** `createRendererRegistry(tableRenderer, …)`, or `RENDERERS` from `@jsudc/react/all`. */
  renderers?: RendererRegistry;
  /** `createCellRegistry(...)`: the cell components a column's `render` may name (README "Custom cells"). */
  cells?: CellRegistry;
  /**
   * The default handlers of the bulk actions of every data view below, by
   * `kind` (README "Selection and bulk actions"); a view's `actions` win.
   */
  actions?: BulkActionHandlers;
  children: ReactNode;
}) {
  let inner = <UdcClientContext.Provider value={client}>{children}</UdcClientContext.Provider>;
  if (links) inner = <UdcLinksProvider links={links}>{inner}</UdcLinksProvider>;
  if (cells) inner = <UdcCellsProvider cells={cells}>{inner}</UdcCellsProvider>;
  if (actions) inner = <UdcActionsProvider actions={actions}>{inner}</UdcActionsProvider>;
  if (renderers) inner = <UdcRenderersProvider renderers={renderers}>{inner}</UdcRenderersProvider>;
  return kit ? <UdcUiProvider kit={kit}>{inner}</UdcUiProvider> : inner;
}
