import type { UdcClient } from "@jsudc/core/client";
import type { ReactNode } from "react";
import { UdcRenderersProvider } from "../renderers/context";
import type { RendererRegistry } from "../renderers/types";
import { UdcUiProvider } from "../ui-kit/context";
import type { UiKit } from "../ui-kit/types";
import { UdcClientContext } from "./client";

export { createUdcQueryClient, shouldRetry, useUdcClient } from "./client";

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
  children,
}: {
  client: UdcClient;
  kit?: UiKit;
  /** `createRendererRegistry(tableRenderer, …)`, or `RENDERERS` from `@jsudc/react/all`. */
  renderers?: RendererRegistry;
  children: ReactNode;
}) {
  let inner = <UdcClientContext.Provider value={client}>{children}</UdcClientContext.Provider>;
  if (renderers) inner = <UdcRenderersProvider renderers={renderers}>{inner}</UdcRenderersProvider>;
  return kit ? <UdcUiProvider kit={kit}>{inner}</UdcUiProvider> : inner;
}
