import {
  type ActionRequest,
  type Capabilities,
  evaluateFilter,
  type FilterNode,
  type HostAction,
  type HostActionPayload,
  type HostActionResponse,
  isVersionConflict,
  type ListResponse,
  type Row,
  type SortKey,
} from "@jsudc/core";
import type { UdcClient } from "@jsudc/core/client";
import {
  keepPreviousData,
  type QueryClient,
  type UseMutationOptions,
  type UseMutationResult,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { useUdcChanges } from "./changes.js";
import { useUdcClient } from "./client.js";
import { type ListKeyParams, type PagingMode, udcKeys } from "./keys.js";
import { applyToListRows, isInfinite, type ListCache } from "./listCache.js";

export { applyToListRows };

export function useUdcCollections() {
  const client = useUdcClient();
  return useQuery({ queryKey: udcKeys.collections(), queryFn: () => client.collections() });
}

export function useUdcDescribe(collection: string, opts: { enabled?: boolean } = {}) {
  const client = useUdcClient();
  return useQuery({
    queryKey: udcKeys.describe(collection),
    queryFn: () => client.describe(collection),
    staleTime: 5 * 60_000,
    enabled: (opts.enabled ?? true) && collection !== "",
  });
}

/** The file a `source_yaml` collection is read from (`source.read`); fetched again on every mount. */
export function useUdcSource(collection: string, opts: { enabled?: boolean } = {}) {
  const client = useUdcClient();
  return useQuery({
    queryKey: udcKeys.source(collection),
    queryFn: () => client.sourceRead(collection),
    staleTime: 0,
    enabled: (opts.enabled ?? true) && collection !== "",
  });
}

export interface UseUdcCollectionArgs {
  collection: string;
  filter?: FilterNode | undefined;
  sort?: SortKey[];
  mode: PagingMode;
  pageLimit: number;
  /** 1-based; pages mode only. */
  page?: number;
  enabled?: boolean;
  /**
   * From `describe`: a source without `cursor` paging is walked by offset in
   * infinite mode too; `changes` says whether it offers the change feed.
   */
  capabilities?: Pick<Capabilities, "paging" | "changes"> | undefined;
  /**
   * Poll: refetch the loaded rows this often (the view's `refresh_interval_ms`).
   * Suspended while the provider's change feed carries the collection.
   */
  refetchInterval?: number | undefined;
  /**
   * The search box's text, sent as `ListRequest.search` for a source that
   * answers search itself (`capabilities.search === "source"`); blank or
   * absent: no `search` in the request, nor in the query key.
   */
  search?: string | undefined;
}

export interface UdcCollectionResult {
  rows: Row[];
  total: number | null;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
  /** Infinite mode only; always false in pages mode. */
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  /** A source serving a fetched copy: when it was fetched, and whether the last refresh failed. */
  fetchedAt: string | null;
  stale: boolean;
}

/** `refetchInterval` for TanStack: a positive number of ms, else off. */
export function pollInterval(ms: number | undefined): number | false {
  return typeof ms === "number" && ms > 0 ? ms : false;
}

/** The freshness of a list answer: `fetched_at` and `stale` when the source sent them. */
export function freshnessOf(res: Pick<ListResponse, "fetched_at" | "stale"> | undefined): {
  fetchedAt: string | null;
  stale: boolean;
} {
  return { fetchedAt: res?.fetched_at ?? null, stale: res?.stale === true };
}

/** `{ search }` for a non-blank text, else nothing: spread into a list request and its query key. */
export function searchPart(search: string | undefined): { search?: string } {
  const text = search?.trim();
  return text ? { search: text } : {};
}

/** The `offset` a 1-based page asks for. */
export function pageOffset(page: number, limit: number): number {
  return Math.max(0, Math.floor(page) - 1) * limit;
}

/**
 * Rows of one collection. Infinite mode follows `next_cursor` page by page
 * (`useInfiniteQuery`), or the next `offset` while rows remain when the
 * source pages by offset only; pages mode asks for one `offset` page
 * (`useQuery`). Both hooks are always mounted and the inactive one is
 * disabled, so switching modes keeps each cache warm. `refetchInterval`
 * polls the active one.
 */
export function useUdcCollection(args: UseUdcCollectionArgs): UdcCollectionResult {
  const client = useUdcClient();
  const { collection, filter, mode, pageLimit: limit } = args;
  const sort = args.sort ?? [];
  const page = Math.max(1, args.page ?? 1);
  const enabled = args.enabled ?? true;
  const byCursor = args.capabilities?.paging?.includes("cursor") ?? true;
  // The change feed (when the provider has one) refetches on events; the timer covers the rest.
  const feed = useUdcChanges(collection, undefined, {
    capabilities: args.capabilities,
    enabled,
  });
  const refetchInterval = feed.live ? false : pollInterval(args.refetchInterval);
  const searched = searchPart(args.search);

  const infiniteParams: ListKeyParams = { filter, sort, limit, mode: "infinite", ...searched };
  const infinite = useInfiniteQuery({
    queryKey: udcKeys.list(collection, infiniteParams),
    queryFn: ({ pageParam, signal }) =>
      client.list(
        {
          collection,
          ...(filter ? { filter } : {}),
          sort,
          ...searched,
          page:
            typeof pageParam === "number"
              ? { limit, offset: pageParam }
              : pageParam
                ? { limit, cursor: pageParam }
                : { limit },
        },
        { signal },
      ),
    initialPageParam: null as string | number | null,
    getNextPageParam: (last, all) => {
      if (byCursor) return last.next_cursor ?? undefined;
      const loaded = all.reduce((n, p) => n + p.rows.length, 0);
      // No total (`total_count: false`): a full page means there may be more.
      const more = last.total !== null ? loaded < last.total : last.rows.length >= limit;
      return last.rows.length > 0 && more ? loaded : undefined;
    },
    placeholderData: keepPreviousData,
    enabled: enabled && mode === "infinite",
    refetchInterval,
  });

  const pagesParams: ListKeyParams = { filter, sort, limit, mode: "pages", page, ...searched };
  const paged = useQuery({
    queryKey: udcKeys.list(collection, pagesParams),
    queryFn: ({ signal }) =>
      client.list(
        {
          collection,
          ...(filter ? { filter } : {}),
          sort,
          ...searched,
          page: { limit, offset: pageOffset(page, limit) },
        },
        { signal },
      ),
    placeholderData: keepPreviousData,
    enabled: enabled && mode === "pages",
    refetchInterval,
  });

  if (mode === "infinite") {
    const pages = infinite.data?.pages ?? [];
    return {
      rows: pages.flatMap((p) => p.rows),
      total: pages[0]?.total ?? null,
      isLoading: infinite.isLoading,
      isFetching: infinite.isFetching,
      error: infinite.error,
      refetch: () => void infinite.refetch(),
      hasNextPage: infinite.hasNextPage,
      isFetchingNextPage: infinite.isFetchingNextPage,
      fetchNextPage: () => void infinite.fetchNextPage(),
      ...freshnessOf(pages[0]),
    };
  }
  return {
    rows: paged.data?.rows ?? [],
    total: paged.data?.total ?? null,
    isLoading: paged.isLoading,
    isFetching: paged.isFetching,
    error: paged.error,
    refetch: () => void paged.refetch(),
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: () => {},
    ...freshnessOf(paged.data),
  };
}

export const ALL_ROWS_MAX = 2000;
const ALL_ROWS_PAGE = 500;

export interface FetchAllRowsArgs {
  collection: string;
  filter?: FilterNode | undefined;
  sort?: SortKey[];
  /** Stop after this many rows. */
  max: number;
  /** Rows per `list` call. */
  pageLimit?: number;
  /** Keyset paging unless the source pages by offset only. */
  cursor: boolean;
  /** Sent as `ListRequest.search` when not blank (a source that answers search). */
  search?: string | undefined;
  signal?: AbortSignal;
  onProgress?: (loaded: number, total: number | null) => void;
}

/**
 * Every row of a filter, `list` page after page, until `total` or `max`.
 * Follows `next_cursor` when keyset paging is on; a source that answers no
 * cursor while rows remain is walked on by offset. Answers one list whose
 * `total` is the server's (so `rows.length < total` means capped), with the
 * first page's `fetched_at` and `stale`.
 */
export async function fetchAllRows(
  client: UdcClient,
  args: FetchAllRowsArgs,
): Promise<ListResponse> {
  const { collection, filter, max } = args;
  const sort = args.sort ?? [];
  const pageLimit = args.pageLimit ?? ALL_ROWS_PAGE;
  const rows: Row[] = [];
  let total: number | null = null;
  let freshness: Pick<ListResponse, "fetched_at" | "stale"> = {};
  let cursor: string | null = null;
  let byCursor = args.cursor;
  while (rows.length < max) {
    const limit = Math.min(pageLimit, max - rows.length);
    const page = byCursor
      ? cursor
        ? { limit, cursor }
        : { limit }
      : { limit, offset: rows.length };
    const res = await client.list(
      { collection, ...(filter ? { filter } : {}), sort, ...searchPart(args.search), page },
      args.signal ? { signal: args.signal } : undefined,
    );
    if (rows.length === 0) {
      freshness = {
        ...(res.fetched_at === undefined ? {} : { fetched_at: res.fetched_at }),
        ...(res.stale === undefined ? {} : { stale: res.stale }),
      };
    }
    rows.push(...res.rows);
    total = res.total;
    args.onProgress?.(rows.length, total);
    if (res.rows.length === 0 || (total !== null && rows.length >= total)) break;
    if (byCursor) {
      if (res.next_cursor) cursor = res.next_cursor;
      else if (total === null) break;
      else byCursor = false;
    } else if (total === null && res.rows.length < limit) {
      break;
    }
  }
  return { ...freshness, rows, next_cursor: null, total: total ?? rows.length };
}

export interface UseUdcAllRowsArgs {
  collection: string;
  filter?: FilterNode | undefined;
  sort?: SortKey[];
  /** Default 2,000. */
  max?: number;
  /** From `describe`: whether the source pages by cursor, and offers the change feed. */
  capabilities?: Pick<Capabilities, "paging" | "changes"> | undefined;
  enabled?: boolean;
  /**
   * Poll: refetch every row this often (the view's `refresh_interval_ms`).
   * Suspended while the provider's change feed carries the collection.
   */
  refetchInterval?: number | undefined;
  /** Sent as `ListRequest.search` when not blank (`capabilities.search === "source"`). */
  search?: string | undefined;
}

export interface UdcAllRowsResult {
  rows: Row[];
  total: number | null;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
  /** More rows match than `max`: only the first `max` are here. */
  capped: boolean;
  /** Rows loaded so far by the fetch in flight, for a progress bar. */
  progress: { loaded: number; total: number | null } | null;
  fetchedAt: string | null;
  stale: boolean;
}

/**
 * All rows of the current filter in one cached list: what the kanban (and
 * the calendar, tree, map and charts after it) draw from. The cache entry
 * sits under `udcKeys.lists(collection)`, so `useUdcMutate`'s optimistic
 * patches and invalidations reach it like every other list.
 */
export function useUdcAllRows(args: UseUdcAllRowsArgs): UdcAllRowsResult {
  const client = useUdcClient();
  const { collection, filter } = args;
  const sort = args.sort ?? [];
  const max = args.max ?? ALL_ROWS_MAX;
  const cursor = args.capabilities?.paging?.includes("cursor") ?? true;
  const [progress, setProgress] = useState<UdcAllRowsResult["progress"]>(null);
  const feed = useUdcChanges(collection, undefined, {
    capabilities: args.capabilities,
    enabled: args.enabled ?? true,
  });

  const searched = searchPart(args.search);
  const key: ListKeyParams = { filter, sort, limit: max, mode: "all", ...searched };
  const query = useQuery({
    queryKey: udcKeys.list(collection, key),
    queryFn: async ({ signal }) => {
      setProgress({ loaded: 0, total: null });
      try {
        return await fetchAllRows(client, {
          collection,
          filter,
          sort,
          max,
          cursor,
          ...searched,
          signal,
          onProgress: (loaded, total) => setProgress({ loaded, total }),
        });
      } finally {
        setProgress(null);
      }
    },
    placeholderData: keepPreviousData,
    enabled: args.enabled ?? true,
    refetchInterval: feed.live ? false : pollInterval(args.refetchInterval),
  });

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? null;
  return {
    rows,
    total,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: () => query.refetch(),
    capped: total !== null && rows.length < total,
    progress,
    ...freshnessOf(query.data),
  };
}

/** `data` with every row whose id is `id` passed through `patch`. */
export function patchRowInList(
  data: ListCache | undefined,
  id: string,
  patch: (row: Row) => Row,
): ListCache | undefined {
  if (!data) return data;
  const patchPage = (page: ListResponse): ListResponse =>
    page.rows.some((r) => r.__meta.id === id)
      ? { ...page, rows: page.rows.map((r) => (r.__meta.id === id ? patch(r) : r)) }
      : page;
  return isInfinite(data) ? { ...data, pages: data.pages.map(patchPage) } : patchPage(data);
}

function patchRowEverywhere(
  qc: QueryClient,
  collection: string,
  id: string,
  patch: (row: Row) => Row,
) {
  qc.setQueriesData<ListCache>({ queryKey: udcKeys.lists(collection) }, (data) =>
    patchRowInList(data, id, patch),
  );
}

export type UdcMutateVars = Omit<ActionRequest<"mutate">, "collection">;

/**
 * Insert / update / delete one row. An update is applied optimistically to
 * the row in every cached list page and rolled back if the server says no.
 * A `version_conflict` additionally re-reads the row, so the cache holds the
 * value that won; the error still reaches the caller. Lists are invalidated
 * once the call settles.
 */
export function useUdcMutate(collection: string) {
  const client = useUdcClient();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (vars: UdcMutateVars) => client.mutate({ collection, ...vars }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: udcKeys.lists(collection) });
      const snapshot = qc.getQueriesData<ListCache>({ queryKey: udcKeys.lists(collection) });
      const { id, row } = vars;
      if (vars.op === "update" && id && row) {
        patchRowEverywhere(qc, collection, id, (r) => ({ ...r, ...row, __meta: r.__meta }));
      }
      return { snapshot };
    },
    onSuccess: (res) => {
      patchRowEverywhere(qc, collection, res.row.__meta.id, () => res.row);
    },
    onError: async (err, vars, ctx) => {
      for (const [key, data] of ctx?.snapshot ?? []) qc.setQueryData(key, data);
      if (isVersionConflict(err) && vars.id) {
        try {
          const fresh = await client.read(collection, vars.id);
          patchRowEverywhere(qc, collection, vars.id, () => fresh.row);
        } catch {
          // The invalidation below refetches the lists anyway.
        }
      }
    },
    // A row of this collection may be another collection's lookup label: those batches go stale too.
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: udcKeys.lists(collection) }),
        qc.invalidateQueries({ queryKey: udcKeys.lookups(collection) }),
        qc.invalidateQueries({ queryKey: ["udc", "lookup-options", collection] }),
      ]),
  });
}

/**
 * The three schema edits. Each answers the new schema; `describe` (which
 * derives the columns) and the lists are refetched afterwards.
 */
export function useUdcSchema(collection: string) {
  const client = useUdcClient();
  const qc = useQueryClient();
  const onSuccess = async () => {
    await qc.invalidateQueries({ queryKey: udcKeys.describe(collection) });
    await qc.invalidateQueries({ queryKey: udcKeys.lists(collection) });
  };

  const addField = useMutation({
    mutationFn: (req: Omit<ActionRequest<"schema.add_field">, "collection">) =>
      client.schemaAddField({ collection, ...req }),
    onSuccess,
  });
  const updateField = useMutation({
    mutationFn: (req: Omit<ActionRequest<"schema.update_field">, "collection">) =>
      client.schemaUpdateField({ collection, ...req }),
    onSuccess,
  });
  const softDeleteField = useMutation({
    mutationFn: (field: string) => client.schemaSoftDeleteField({ collection, field }),
    onSuccess,
  });
  return { addField, updateField, softDeleteField };
}

// mutate_many and host actions (0.5.0) --------------------------------------

export type UdcMutateManyVars = Omit<ActionRequest<"mutate_many">, "collection">;

/**
 * Which cached row a `mutate_many` request touches: one of its `ids`, or a row
 * its `filter` matches (evaluated in the browser, `evaluateFilter`) that is
 * not among `except_ids`. A filter the browser cannot evaluate touches no
 * cached row: the invalidation after the call brings the server's answer.
 */
export function mutateManyTouches(vars: UdcMutateManyVars): (row: Row) => boolean {
  if (vars.ids) {
    const ids = new Set(vars.ids);
    return (row) => ids.has(row.__meta.id);
  }
  const except = new Set(vars.except_ids ?? []);
  const filter = vars.filter;
  return (row) => {
    if (except.has(row.__meta.id)) return false;
    try {
      return evaluateFilter(filter, row);
    } catch {
      return false;
    }
  };
}

/**
 * Change (`update`, the patch in `row`) or delete many rows of a collection in
 * one `mutate_many` request: by `ids`, or by `filter` with `except_ids` ("all
 * that match, except these"). Like `useUdcMutate` for one row, the loaded
 * rows are patched (or removed) in every cached list at once, put back if the
 * call fails, and the collection's lists and lookups are invalidated once it
 * settles. Resolves to the server's `{ updated, failed }`: `failed` names the
 * ids that were not changed, and why.
 */
export function useUdcMutateMany(collection: string) {
  const client = useUdcClient();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (vars: UdcMutateManyVars) => client.mutateMany({ collection, ...vars }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: udcKeys.lists(collection) });
      const snapshot = qc.getQueriesData<ListCache>({ queryKey: udcKeys.lists(collection) });
      const touches = mutateManyTouches(vars);
      const set = vars.row;
      const patch =
        vars.op === "update" && set
          ? (r: Row): Row => ({ ...r, ...set, __meta: r.__meta })
          : undefined;
      if (vars.op === "delete" || patch) {
        qc.setQueriesData<ListCache>({ queryKey: udcKeys.lists(collection) }, (data) =>
          applyToListRows(data, touches, patch),
        );
      }
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      for (const [key, data] of ctx?.snapshot ?? []) qc.setQueryData(key, data);
    },
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: udcKeys.lists(collection) }),
        qc.invalidateQueries({ queryKey: udcKeys.lookups(collection) }),
        qc.invalidateQueries({ queryKey: ["udc", "lookup-options", collection] }),
      ]),
  });
}

/** What `useUdcAction` takes besides TanStack's mutation options. */
export interface UseUdcActionOptions<Res, Req>
  extends Omit<UseMutationOptions<Res, Error, Req>, "mutationFn"> {
  /** Collections whose lists and lookups to invalidate once the call settles (the rows it changed). */
  invalidates?: readonly string[] | undefined;
}

/**
 * A mutation over the client's typed `call`, for any host action: pass the
 * action's definition (`defineHostAction`, shared with the server) and the
 * payload and the result are typed from its schemas; or pass a name and type
 * it yourself (`useUdcAction<Res, Req>("mail.snooze")`). `invalidates` names
 * the collections whose lists to refetch afterwards.
 */
export function useUdcAction<H extends HostAction>(
  action: H,
  options?: UseUdcActionOptions<HostActionResponse<H>, HostActionPayload<H>>,
): UseMutationResult<HostActionResponse<H>, Error, HostActionPayload<H>>;
export function useUdcAction<Res = unknown, Req = Record<string, unknown>>(
  action: string,
  options?: UseUdcActionOptions<Res, Req>,
): UseMutationResult<Res, Error, Req>;
export function useUdcAction(
  action: string | HostAction,
  options: UseUdcActionOptions<unknown, unknown> = {},
): UseMutationResult<unknown, Error, unknown> {
  const client = useUdcClient();
  const qc = useQueryClient();
  const { invalidates, onSettled, ...rest } = options;
  return useMutation<unknown, Error, unknown>({
    ...rest,
    mutationFn: (payload) => callAction(client, action, payload),
    onSettled: async (...args) => {
      await Promise.all(
        (invalidates ?? []).flatMap((c) => [
          qc.invalidateQueries({ queryKey: udcKeys.lists(c) }),
          qc.invalidateQueries({ queryKey: udcKeys.lookups(c) }),
        ]),
      );
      return onSettled?.(...args);
    },
  });
}

/** `client.call` for a host action given by definition or by name (the answer unchecked by name). */
export function callAction(
  client: UdcClient,
  action: string | HostAction,
  payload: unknown,
): Promise<unknown> {
  const call = client.call.bind(client) as (a: string | HostAction, p: unknown) => Promise<unknown>;
  return call(action, payload);
}
