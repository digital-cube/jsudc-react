import { isUdcError } from "@jsudc/core";
import type { UdcClient } from "@jsudc/core/client";
import { QueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext } from "react";
import { UdcUiProvider } from "../ui-kit/context";
import type { UiKit } from "../ui-kit/types";

const UdcClientContext = createContext<UdcClient | null>(null);

/**
 * The root provider: the client, and optionally the UI kit the renderers draw
 * with. Without `kit` the kit in effect is kept (an outer `UdcUiProvider`'s,
 * else `defaultUiKit`), so a host on the default kit changes nothing.
 */
export function UdcProvider({
  client,
  kit,
  children,
}: {
  client: UdcClient;
  kit?: UiKit;
  children: ReactNode;
}) {
  const inner = <UdcClientContext.Provider value={client}>{children}</UdcClientContext.Provider>;
  return kit ? <UdcUiProvider kit={kit}>{inner}</UdcUiProvider> : inner;
}

export function useUdcClient(): UdcClient {
  const client = useContext(UdcClientContext);
  if (!client) throw new Error("useUdcClient needs a <UdcProvider client={...}> above it");
  return client;
}

/**
 * A protocol error is the server's answer, not a hiccup: asking again gives
 * the same answer. Only transport failures are retried, twice.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return !isUdcError(error) && failureCount < 2;
}

export function createUdcQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}
