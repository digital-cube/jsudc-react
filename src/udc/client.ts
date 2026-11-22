import { isUdcError, isUnauthenticated, type UdcError } from "@jsudc/core";
import type { UdcClient } from "@jsudc/core/client";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { createContext, useContext } from "react";
import { registerUnauthenticated } from "./unauthenticated.js";

/** The client every hook talks to; `UdcProvider` sets it. */
export const UdcClientContext = createContext<UdcClient | null>(null);

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

export interface UdcQueryClientOptions {
  /**
   * Called when a query or a mutation fails because the user is not signed in
   * (`isUnauthenticated`: an HTTP 401 in front of `/udc`, or the server's
   * in-protocol refusal) — the place to send the user to the host's login.
   * Once per burst: the failures that arrive together (every query of a page,
   * say) make one call; it fires again only after `unauthenticatedQuietMs`
   * without such a failure.
   */
  onUnauthenticated?: (error: UdcError) => void;
  /** The quiet time, in ms, that ends a burst of unauthenticated failures. Default 2000. */
  unauthenticatedQuietMs?: number;
}

/**
 * Calls `fn` on the first unauthenticated error and swallows the rest until
 * `quietMs` pass without one (each further error restarts that wait).
 */
function unauthenticatedNotifier(
  fn: (error: UdcError) => void,
  quietMs: number,
): (error: unknown) => void {
  let lastAt: number | null = null;
  return (error) => {
    if (!isUnauthenticated(error)) return;
    const now = Date.now();
    const inBurst = lastAt !== null && now - lastAt < quietMs;
    lastAt = now;
    if (!inBurst) fn(error as UdcError);
  };
}

export function createUdcQueryClient(options: UdcQueryClientOptions = {}): QueryClient {
  const notify = options.onUnauthenticated
    ? unauthenticatedNotifier(options.onUnauthenticated, options.unauthenticatedQuietMs ?? 2000)
    : undefined;
  const qc = new QueryClient({
    ...(notify
      ? {
          queryCache: new QueryCache({ onError: notify }),
          mutationCache: new MutationCache({ onError: notify }),
        }
      : {}),
    defaultOptions: {
      queries: { retry: shouldRetry, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
  // The change feed's unauthenticated error takes the same path (and the same burst).
  if (notify) registerUnauthenticated(qc, notify);
  return qc;
}
