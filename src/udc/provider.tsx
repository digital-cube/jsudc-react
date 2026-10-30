import type { UdcClient } from "@jsudc/core/client";
import type { ReactNode } from "react";
import { UdcRenderersProvider } from "../renderers/context.js";
import type { RendererRegistry } from "../renderers/types.js";
import { UdcUiProvider } from "../ui-kit/context.js";
import type { UiKit } from "../ui-kit/types.js";
import { UdcClientContext } from "./client.js";

export { createUdcQueryClient, shouldRetry, useUdcClient } from "./client.js";

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
