import { type Capabilities, type ChangeEvent, sourcePushesChanges } from "@jsudc/core";
import { QueryClientContext, useQueries } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useRef, useSyncExternalStore } from "react";
import type { UdcChangeFeed, UdcChangeFeedStatus } from "./changeFeed.js";
import { UdcClientContext } from "./client.js";
import { udcKeys } from "./keys.js";

/**
 * The provider's change feed; `null` when `UdcProvider changes` is off (the
 * default). A host may provide a `UdcChangeFeed` of its own here (one per
 * user, say: `useMemo(() => new UdcChangeFeed(client, opts), [client, user])`,
 * closed with `feed.close()` when replaced); a `UdcProvider` below it with
 * the same client and without `changes` uses it.
 */
export const UdcChangeFeedContext = createContext<UdcChangeFeed | null>(null);

/** The provider's change feed, or `null` without one. */
export function useUdcChangeFeed(): UdcChangeFeed | null {
  return useContext(UdcChangeFeedContext);
}

export interface UseUdcChangesOptions {
  /**
   * The collection's capabilities when the caller has them (`describe`): with
   * `changes` set, no `describe` is asked; without it the hook reads the
   * cached `describe` of the collection (only when the provider has a feed).
   */
  capabilities?: Pick<Capabilities, "changes"> | undefined;
  /** `false`: no subscription (a hidden or disabled view). Default `true`. */
  enabled?: boolean | undefined;
}

export interface UdcChangesResult {
  /** Where the feed stands for this collection (see `UdcChangeFeedStatus`). */
  status: UdcChangeFeedStatus;
  /** `status === "live"`: the stream carries the collection, timer polling is suspended. */
  live: boolean;
}

const noSubscribe = () => () => {};

/**
 * Subscribe `collections` to the provider's feed, each one that offers
 * `capabilities.changes`. Nothing at all (no `describe`, no connection) when
 * the provider has no feed. Answers the collections that are subscribed.
 */
function useFeedSubscriptions(
  collections: readonly string[],
  onEvent: ((event: ChangeEvent) => void) | undefined,
  opts: UseUdcChangesOptions,
): { feed: UdcChangeFeed | null; offered: string[] } {
  const feed = useContext(UdcChangeFeedContext);
  const client = useContext(UdcClientContext);
  const qc = useContext(QueryClientContext);
  const on = feed !== null && client !== null && qc !== undefined && (opts.enabled ?? true);
  const wanted = on ? [...new Set(collections.filter((c) => c !== ""))] : [];
  const known = opts.capabilities?.changes;
  // The capability, from `describe` (cached for minutes, shared with the view that shows it).
  const described = useQueries({
    queries:
      known === undefined && client
        ? wanted.map((c) => ({
            queryKey: udcKeys.describe(c),
            queryFn: () => client.describe(c),
            staleTime: 5 * 60_000,
          }))
        : [],
  });
  const offered =
    known === undefined
      ? wanted.filter((_, i) => sourcePushesChanges(described[i]?.data?.capabilities))
      : known
        ? wanted
        : [];

  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  });
  const hasOnEvent = onEvent !== undefined;
  const key = offered.join("\n");
  useEffect(() => {
    if (!feed || !qc || key === "") return;
    const listener = hasOnEvent ? (e: ChangeEvent) => onEventRef.current?.(e) : undefined;
    const offs = key.split("\n").map((c) => feed.subscribe(c, qc, listener));
    return () => {
      for (const off of offs) off();
    };
  }, [feed, qc, key, hasOnEvent]);
  return { feed, offered };
}

/**
 * Follow the change feed of `collection`: while it is mounted the provider's
 * stream carries the collection (`UdcProvider changes`), its lists and lookups
 * are refetched when the server says its rows changed, and `onEvent` (if
 * given) hears each `ChangeEvent` as it arrives (e.g. a badge counter).
 * Answers where the feed stands; `live` is when the views of the collection
 * stop polling. Without a feed in the provider, or for a collection that does
 * not offer `capabilities.changes`, it does nothing and answers `off`.
 */
export function useUdcChanges(
  collection: string,
  onEvent?: (event: ChangeEvent) => void,
  opts: UseUdcChangesOptions = {},
): UdcChangesResult {
  const { feed, offered } = useFeedSubscriptions([collection], onEvent, opts);
  const subscribed = offered.length > 0;
  const status = useSyncExternalStore(
    feed ? (l: () => void) => feed.onStatus(l) : noSubscribe,
    () => (feed && subscribed ? feed.status(collection) : "off"),
    () => "off" as const,
  );
  return { status, live: status === "live" };
}

/** `useUdcChanges` for several collections at once, without a status (the lookup hooks). */
export function useUdcChangesMany(
  collections: readonly string[],
  opts: Omit<UseUdcChangesOptions, "capabilities"> = {},
): void {
  useFeedSubscriptions(collections, undefined, opts);
}
