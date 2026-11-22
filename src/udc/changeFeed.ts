import { type ChangeEvent, isUnauthenticated } from "@jsudc/core";
import type { ChangesOptions, UdcClient } from "@jsudc/core/client";
import type { Query, QueryClient } from "@tanstack/react-query";
import { udcKeys } from "./keys.js";
import { applyToListRows, type ListCache } from "./listCache.js";
import { notifyUnauthenticated } from "./unauthenticated.js";

/**
 * Where the change feed stands for one collection, as `useUdcChanges` reports
 * it:
 * - `off`: no feed (the provider has none, or the collection does not offer
 *   `capabilities.changes`); the view polls as it always did.
 * - `connecting`: subscribed, the stream that carries it is not open yet.
 * - `live`: the stream is open; timer polling is suspended.
 * - `reconnecting`: the stream dropped and is being reopened; polling resumes.
 * - `down`: the server refused the stream (signed out, forbidden, unknown
 *   collection); no reconnecting, polling only.
 */
export type UdcChangeFeedStatus = "off" | "connecting" | "live" | "reconnecting" | "down";

/** `UdcProvider changes={…}`: `true` takes every default. */
export interface UdcChangeFeedOptions {
  /** A burst of events for one collection within this many ms makes one invalidation. Default 200. */
  debounceMs?: number;
  /**
   * How long to wait after a view mounts or unmounts before the stream is
   * reopened with the new list of collections, so a page that mounts several
   * views opens one stream. Default 50.
   */
  batchMs?: number;
  /**
   * A `delete` event that names its ids removes those rows from the cached
   * lists at once, before the refetch. Default `true`.
   */
  removeDeleted?: boolean;
  /** Passed to `UdcClient.changes`: the first reconnect delay. */
  minDelayMs?: number;
  /** Passed to `UdcClient.changes`: the longest reconnect delay. */
  maxDelayMs?: number;
  /** Passed to `UdcClient.changes`: a silent stream is reopened after this long. */
  idleTimeoutMs?: number;
}

interface Subscriber {
  qc: QueryClient;
  onEvent: ((event: ChangeEvent) => void) | undefined;
}

type ConnState = "connecting" | "live" | "reconnecting" | "down";

interface Conn {
  key: string;
  collections: ReadonlySet<string>;
  ctl: AbortController;
  state: ConnState;
  /** When the stream was asked for: data fetched before it may have missed an event. */
  startedAt: number;
  /** Opened by `reconnect()`: no stream carries its collections until it is open ("reconnecting"). */
  resumed: boolean;
}

const keyOf = (collections: Iterable<string>) => [...collections].sort().join("\n");

/**
 * The change feed of one `UdcProvider`: one stream for every collection a
 * mounted view (or hook) shows. Collections are reference-counted; when the
 * set changes the new stream is opened first and the old one closed only once
 * the new one is subscribed, so the collections that stay miss nothing. An
 * event marks its collection dirty and, after `debounceMs`, its lists, lookup
 * batches and lookup options are invalidated; "reconnected" invalidates every
 * collection of the stream. Framework-free apart from TanStack's QueryClient;
 * `useUdcChanges` is the React side.
 */
export class UdcChangeFeed {
  readonly client: UdcClient;
  private readonly opts: Required<
    Omit<UdcChangeFeedOptions, "minDelayMs" | "maxDelayMs" | "idleTimeoutMs">
  > &
    Pick<UdcChangeFeedOptions, "minDelayMs" | "maxDelayMs" | "idleTimeoutMs">;
  private readonly subs = new Map<string, Set<Subscriber>>();
  private current: Conn | null = null;
  private pending: Conn | null = null;
  private reconcileTimer: ReturnType<typeof setTimeout> | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly dirty = new Map<string, number | undefined>();
  private readonly listeners = new Set<() => void>();

  constructor(client: UdcClient, options: UdcChangeFeedOptions = {}) {
    this.client = client;
    this.opts = {
      debounceMs: options.debounceMs ?? 200,
      batchMs: options.batchMs ?? 50,
      removeDeleted: options.removeDeleted ?? true,
      ...(options.minDelayMs === undefined ? {} : { minDelayMs: options.minDelayMs }),
      ...(options.maxDelayMs === undefined ? {} : { maxDelayMs: options.maxDelayMs }),
      ...(options.idleTimeoutMs === undefined ? {} : { idleTimeoutMs: options.idleTimeoutMs }),
    };
  }

  /**
   * Count one more user of `collection` (whose queries live in `qc`); the
   * returned function counts it out. `onEvent` hears every event of the
   * collection as it arrives, before the debounced invalidation.
   */
  subscribe(collection: string, qc: QueryClient, onEvent?: (event: ChangeEvent) => void) {
    const sub: Subscriber = { qc, onEvent };
    let set = this.subs.get(collection);
    if (!set) {
      set = new Set();
      this.subs.set(collection, set);
    }
    set.add(sub);
    this.scheduleReconcile();
    this.emit();
    let done = false;
    return () => {
      if (done) return;
      done = true;
      const s = this.subs.get(collection);
      s?.delete(sub);
      if (s?.size === 0) this.subs.delete(collection);
      this.scheduleReconcile();
      this.emit();
    };
  }

  /** The collections the stream is (or is about to be) asked for. */
  collections(): string[] {
    return [...this.subs.keys()].sort();
  }

  /** Where the feed stands for `collection`. */
  status(collection: string): UdcChangeFeedStatus {
    if (!this.subs.has(collection)) return "off";
    const cur = this.current;
    if (cur?.collections.has(collection) && !(cur.state === "down" && this.pending)) {
      return cur.state;
    }
    const pen = this.pending;
    if (pen?.collections.has(collection)) {
      if (pen.state === "live" || pen.state === "down") return pen.state;
      return pen.resumed ? "reconnecting" : "connecting";
    }
    return "connecting";
  }

  /** Called whenever a status may have changed (for `useSyncExternalStore`). */
  onStatus(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Close the stream and open it again for the same collections, now: the
   * server runs the plugin's `context` again, so the stream is scoped to
   * whoever `UdcClient`'s `headers` (or cookies) say is signed in now. For an
   * identity switch with a `headers` function (a demo user, an account
   * switcher, impersonation), or after signing in again, since a stream the
   * server refused is otherwise not asked for until the set of collections
   * changes. Meanwhile the collections report `reconnecting` (polling
   * resumes); once it is open, data fetched before the call is refetched. Does
   * nothing while nobody is subscribed. `UdcProvider changes={{ identity }}`
   * calls it when `identity` changes.
   */
  reconnect(): void {
    if (this.reconcileTimer) clearTimeout(this.reconcileTimer);
    this.reconcileTimer = null;
    const wanted = this.collections();
    if (wanted.length === 0) {
      this.close();
      return;
    }
    // The open stream carries the previous identity's scope: nothing of it is kept.
    this.pending?.ctl.abort();
    this.current?.ctl.abort();
    this.current = null;
    this.pending = this.open(wanted, keyOf(wanted), true);
    this.emit();
  }

  /** Close the stream and drop every timer; the feed opens again when somebody subscribes. */
  close(): void {
    if (this.reconcileTimer) clearTimeout(this.reconcileTimer);
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.reconcileTimer = this.flushTimer = null;
    this.dirty.clear();
    this.pending?.ctl.abort();
    this.current?.ctl.abort();
    this.pending = this.current = null;
    this.emit();
  }

  // The stream ---------------------------------------------------------------

  private emit() {
    for (const l of this.listeners) l();
  }

  private scheduleReconcile() {
    if (this.reconcileTimer) clearTimeout(this.reconcileTimer);
    this.reconcileTimer = setTimeout(() => {
      this.reconcileTimer = null;
      this.reconcile();
    }, this.opts.batchMs);
  }

  private reconcile() {
    const wanted = this.collections();
    const key = keyOf(wanted);
    if (wanted.length === 0) {
      this.close();
      return;
    }
    const cur = this.current;
    if (cur && cur.key === key) {
      // The set went back to what is open: a reopen in flight is not needed. A stream the
      // server refused for this very set stays refused until the set changes.
      if (this.pending) {
        this.pending.ctl.abort();
        this.pending = null;
        this.emit();
      }
      return;
    }
    if (this.pending?.key === key) return;
    // A set that changes while `reconnect()` is reopening: still no stream carries it.
    const resumed = cur === null && this.pending?.resumed === true;
    this.pending?.ctl.abort();
    this.pending = this.open(wanted, key, resumed);
    this.emit();
  }

  private open(collections: string[], key: string, resumed = false): Conn {
    const conn: Conn = {
      key,
      collections: new Set(collections),
      ctl: new AbortController(),
      state: "connecting",
      startedAt: Date.now(),
      resumed,
    };
    const { minDelayMs, maxDelayMs, idleTimeoutMs } = this.opts;
    const options: ChangesOptions = {
      collections,
      signal: conn.ctl.signal,
      onChange: (event) => this.deliver(conn, event),
      onOpen: ({ reconnected }) => this.opened(conn, reconnected),
      onError: () => this.dropped(conn),
      ...(minDelayMs === undefined ? {} : { minDelayMs }),
      ...(maxDelayMs === undefined ? {} : { maxDelayMs }),
      ...(idleTimeoutMs === undefined ? {} : { idleTimeoutMs }),
    };
    this.client.changes(options).then(
      () => {},
      (err: unknown) => this.refused(conn, err),
    );
    return conn;
  }

  private live(conn: Conn) {
    return conn === this.current || conn === this.pending;
  }

  private opened(conn: Conn, reconnected: boolean) {
    if (!this.live(conn) || conn.ctl.signal.aborted) return;
    const prev = this.current;
    if (conn === this.pending) {
      // The new stream is subscribed: it takes over, the old one closes.
      this.current = conn;
      this.pending = null;
      if (prev && prev !== conn) prev.ctl.abort();
    }
    conn.state = "live";
    if (reconnected) {
      // Changes made while the stream was down were not sent: refetch everything it carries.
      for (const c of conn.collections) this.markDirty(c);
    } else {
      // A collection that was not carried by an open stream until now may have changed between
      // its last fetch and this subscription: refetch what was fetched before the stream was asked for.
      const carried = prev && prev !== conn && prev.state === "live" ? prev.collections : new Set();
      for (const c of conn.collections) if (!carried.has(c)) this.markDirty(c, conn.startedAt);
    }
    this.emit();
  }

  private dropped(conn: Conn) {
    if (!this.live(conn) || conn.ctl.signal.aborted) return;
    conn.state = "reconnecting";
    this.emit();
  }

  /** `changes()` rejected: the server refused (401, 403, 404, 400). No reconnecting. */
  private refused(conn: Conn, err: unknown) {
    if (!this.live(conn) || conn.ctl.signal.aborted) return;
    conn.state = "down";
    if (isUnauthenticated(err))
      for (const qc of this.queryClients()) notifyUnauthenticated(qc, err);
    // A refused reopen stays as `pending` in state `down`: the old stream (if open) still carries
    // what it carried, and the same set is not asked for again until it changes.
    this.emit();
  }

  private deliver(conn: Conn, event: ChangeEvent) {
    if (!this.live(conn) || conn.ctl.signal.aborted) return;
    const subs = this.subs.get(event.collection);
    if (!subs) return; // Not a collection on screen.
    for (const s of [...subs]) {
      try {
        s.onEvent?.(event);
      } catch (err) {
        console.error("useUdcChanges: onEvent threw", err);
      }
    }
    if (event.op === "delete" && event.ids?.length && this.opts.removeDeleted) {
      const gone = new Set(event.ids);
      for (const qc of this.queryClients(event.collection)) {
        qc.setQueriesData<ListCache>({ queryKey: udcKeys.lists(event.collection) }, (data) =>
          applyToListRows(data, (r) => gone.has(r.__meta.id)),
        );
      }
    }
    this.markDirty(event.collection);
  }

  // Invalidation -------------------------------------------------------------

  /**
   * Refetch `collection` after the debounce; `before` limits it to queries
   * whose data is older than that time (a later plain mark lifts the limit).
   */
  private markDirty(collection: string, before?: number) {
    const had = this.dirty.has(collection);
    const prev = this.dirty.get(collection);
    const next =
      before === undefined || (had && prev === undefined) ? undefined : Math.max(prev ?? 0, before);
    this.dirty.set(collection, next);
    this.scheduleFlush();
  }

  private scheduleFlush() {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => this.flush(), this.opts.debounceMs);
  }

  private flush() {
    this.flushTimer = null;
    const clients = this.queryClients();
    // A mutation in flight invalidates when it settles; refetching under it would show the
    // row as it was before the optimistic patch. Wait for it.
    if ([...clients].some((qc) => qc.isMutating() > 0)) {
      this.scheduleFlush();
      return;
    }
    const batch = [...this.dirty];
    this.dirty.clear();
    for (const [collection, before] of batch) {
      const predicate =
        before === undefined
          ? undefined
          : (q: Query) => q.state.dataUpdatedAt > 0 && q.state.dataUpdatedAt < before;
      for (const qc of this.queryClients(collection)) {
        for (const queryKey of invalidatedKeys(collection)) {
          void qc.invalidateQueries(predicate ? { queryKey, predicate } : { queryKey });
        }
      }
    }
  }

  /** The query clients of `collection`'s subscribers, or of everybody's. */
  private queryClients(collection?: string): Set<QueryClient> {
    const out = new Set<QueryClient>();
    const sets = collection === undefined ? [...this.subs.values()] : [this.subs.get(collection)];
    for (const set of sets) for (const s of set ?? []) out.add(s.qc);
    return out;
  }
}

/** What a change of `collection` makes stale: its lists, the lookups into it, its picker options. */
export function invalidatedKeys(collection: string): (readonly unknown[])[] {
  return [
    udcKeys.lists(collection),
    udcKeys.lookups(collection),
    ["udc", "lookup-options", collection],
  ];
}
