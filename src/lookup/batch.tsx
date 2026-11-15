import { type LookupDef, lookupOf, type Row, type SchemaDoc } from "@jsudc/core";
import { createContext, type ReactNode, useContext, useMemo } from "react";
import {
  keyString,
  type LookupRequest,
  lookupKeys,
  type UdcLookupResult,
  useUdcLookups,
} from "./useUdcLookup.js";

/**
 * The labels a renderer resolved for the rows it shows, per lookup field:
 * one `list` per field for the whole page, instead of one per cell.
 */
export type LookupBatch = ReadonlyMap<string, BatchEntry>;

/** One field's labels, and the keys it asked for. */
export interface BatchEntry extends UdcLookupResult {
  lookup: LookupDef;
  asked: ReadonlySet<string>;
}

const LookupBatchContext = createContext<LookupBatch | null>(null);

/**
 * One `useUdcLookup` per lookup field of `schema` (limited to `fields` when
 * given) over the keys `rows` hold. Put the answer in a
 * `<UdcLookupBatch value>` around the cells: each `LookupValue` then reads its
 * labels from it.
 */
export function useLookupBatch(
  rows: readonly Row[],
  schema: Pick<SchemaDoc, "fields">,
  fields?: readonly string[],
): LookupBatch {
  const requests = useMemo<LookupRequest[]>(() => {
    const names = fields ?? Object.keys(schema.fields);
    const out: LookupRequest[] = [];
    for (const field of new Set(names)) {
      const lookup = lookupOf(schema.fields[field]);
      if (!lookup || schema.fields[field]?.deleted) continue;
      out.push({ id: field, lookup, keys: rows.map((r) => r[field]) });
    }
    return out;
  }, [rows, schema.fields, fields]);
  const results = useUdcLookups(requests);
  return useMemo(() => {
    const out = new Map<string, BatchEntry>();
    for (const r of requests) {
      const res = results.get(r.id);
      if (res) out.set(r.id, { ...res, lookup: r.lookup, asked: new Set(lookupKeys(r.keys)) });
    }
    return out;
  }, [requests, results]);
}

export function UdcLookupBatch({ value, children }: { value: LookupBatch; children?: ReactNode }) {
  return <LookupBatchContext.Provider value={value}>{children}</LookupBatchContext.Provider>;
}

/** The batch around this component, if any. */
export function useLookupBatchContext(): LookupBatch | null {
  return useContext(LookupBatchContext);
}

/**
 * The batch's result for `field` when it asked for every key of `keys`;
 * `undefined` otherwise (a row added since the batch ran, a cell outside the
 * batch's fields), and the cell then resolves its keys itself.
 */
export function batchCovers(
  batch: LookupBatch | null,
  field: string | undefined,
  lookup: LookupDef,
  keys: readonly string[],
): UdcLookupResult | undefined {
  if (!batch || !field) return undefined;
  const entry = batch.get(field);
  if (!entry || entry.lookup.collection !== lookup.collection) return undefined;
  return keys.every((k) => entry.asked.has(k)) ? entry : undefined;
}

export { keyString };
