import {
  type FilterNode,
  type LookupDef,
  lookupKeyField,
  lookupKeyOf,
  lookupKeysFilter,
  MAX_PAGE_LIMIT,
  type Row,
} from "@jsudc/core";
import type { UdcClient } from "@jsudc/core/client";
import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useUdcChangesMany } from "../udc/changes.js";
import { useUdcClient } from "../udc/client.js";
import { udcKeys } from "../udc/keys.js";

/** A key as the maps below hold it: `7` and `"7"` are one key, as on the server. */
export const keyString = (key: unknown): string =>
  typeof key === "string" ? key : typeof key === "number" ? String(key) : JSON.stringify(key);

const isKey = (v: unknown): v is string | number =>
  (typeof v === "string" && v !== "") || (typeof v === "number" && Number.isFinite(v));

/** The distinct keys of some lookup values (each one key or a list), as strings, in order of appearance. */
export function valueKeys(values: readonly unknown[]): string[] {
  const out = new Set<string>();
  for (const v of values) {
    for (const k of Array.isArray(v) ? v : [v]) if (isKey(k)) out.add(keyString(k));
  }
  return [...out];
}

/** `valueKeys`, sorted: what a lookup query is keyed and asked by. */
export function lookupKeys(values: readonly unknown[]): string[] {
  return valueKeys(values).sort();
}

/** `string` (a collection, keyed by id) or a lookup block, as a lookup block. */
export function asLookup(target: string | LookupDef): LookupDef {
  return typeof target === "string" ? { collection: target, label_field: "" } : target;
}

/** The target rows of a lookup, keyed by `keyString` of their key. */
export type LookupRows = ReadonlyMap<string, Row>;

/** `list` the target rows of `keys`, one call per 1000 keys (the page limit). */
export async function fetchLookupRows(
  client: UdcClient,
  lookup: LookupDef,
  keys: readonly string[],
  signal?: AbortSignal,
): Promise<Map<string, Row>> {
  const out = new Map<string, Row>();
  for (let i = 0; i < keys.length; i += MAX_PAGE_LIMIT) {
    const chunk = keys.slice(i, i + MAX_PAGE_LIMIT);
    const filter: FilterNode = lookupKeysFilter(lookup, chunk);
    const res = await client.list(
      { collection: lookup.collection, filter, page: { limit: chunk.length } },
      signal ? { signal } : undefined,
    );
    for (const row of res.rows) out.set(keyString(lookupKeyOf(row, lookup)), row);
  }
  return out;
}

/**
 * The query of one lookup: `["udc", "lookup", collection, sortedKeys]` (and
 * the key field when it is not the id), one batch `list` with an `in` filter.
 */
export function lookupQuery(client: UdcClient, lookup: LookupDef, keys: readonly string[]) {
  const field = lookupKeyField(lookup);
  return {
    queryKey: udcKeys.lookup(lookup.collection, keys, field),
    queryFn: ({ signal }: { signal?: AbortSignal }) =>
      fetchLookupRows(client, lookup, keys, signal),
    enabled: keys.length > 0 && lookup.collection !== "",
    staleTime: 60_000,
    // While the next set of keys loads (a new page arrived), keep showing the labels already known.
    placeholderData: keepPreviousData,
  };
}

export interface UdcLookupResult {
  rows: LookupRows;
  /** The target row of `key`, once loaded. */
  row: (key: unknown) => Row | undefined;
  isLoading: boolean;
  error: Error | null;
}

const EMPTY: LookupRows = new Map();

function result(data: LookupRows | undefined, isLoading: boolean, error: Error | null) {
  const rows = data ?? EMPTY;
  return { rows, row: (key: unknown) => rows.get(keyString(key)), isLoading, error };
}

/**
 * The rows of `target` whose key is in `keys`: one `list` with an `in`
 * filter over the key field (the row id without a `key_field`), cached in
 * TanStack Query by collection and sorted keys. `target` is a collection
 * name (keys are ids) or a field's `lookup` block.
 */
export function useUdcLookup(
  target: string | LookupDef,
  keys: readonly unknown[],
  opts: { enabled?: boolean } = {},
): UdcLookupResult {
  const client = useUdcClient();
  const lookup = asLookup(target);
  const sorted = useMemo(() => lookupKeys(keys), [keys]);
  const q = lookupQuery(client, lookup, sorted);
  const enabled = q.enabled && (opts.enabled ?? true);
  // A change of the target collection may change the labels shown (the provider's change feed).
  useUdcChangesMany([lookup.collection], { enabled });
  const res = useQuery({ ...q, enabled });
  return result(res.data, res.isLoading, res.error);
}

export interface LookupRequest {
  /** What the result is filed under (the field name). */
  id: string;
  lookup: LookupDef;
  keys: readonly unknown[];
}

/** `useUdcLookup` for several lookups at once (one query each), keyed by request id. */
export function useUdcLookups(requests: readonly LookupRequest[]): Map<string, UdcLookupResult> {
  const client = useUdcClient();
  const queries = useMemo(
    () => requests.map((r) => lookupQuery(client, r.lookup, lookupKeys(r.keys))),
    [client, requests],
  );
  const results = useQueries({ queries });
  useUdcChangesMany(requests.filter((_, i) => queries[i]?.enabled).map((r) => r.lookup.collection));
  return useMemo(() => {
    const out = new Map<string, UdcLookupResult>();
    requests.forEach((r, i) => {
      const res = results[i];
      out.set(r.id, result(res?.data, res?.isLoading ?? false, res?.error ?? null));
    });
    return out;
  }, [requests, results]);
}
