import type { QueryClient } from "@tanstack/react-query";

/**
 * The `onUnauthenticated` notifier of each query client `createUdcQueryClient`
 * made, so a failure outside TanStack (the change feed) takes the same path as
 * a failed query, burst limiting included. Internal: not exported.
 */
const notifiers = new WeakMap<QueryClient, (error: unknown) => void>();

export function registerUnauthenticated(qc: QueryClient, notify: (error: unknown) => void): void {
  notifiers.set(qc, notify);
}

/** Hand `error` to `qc`'s `onUnauthenticated` (it checks `isUnauthenticated` itself). */
export function notifyUnauthenticated(qc: QueryClient, error: unknown): void {
  notifiers.get(qc)?.(error);
}
