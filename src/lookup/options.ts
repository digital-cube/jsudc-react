import { type FilterNode, type LookupDef, lookupKeyOf, type Row } from "@jsudc/core";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useUdcChangesMany } from "../udc/changes.js";
import { useUdcClient } from "../udc/client.js";
import { udcKeys } from "../udc/keys.js";
import { lookupLabel } from "./label.js";
import { keyString } from "./useUdcLookup.js";

/** How many target rows a picker lists; above this it searches by `label_field` instead. */
export const LOOKUP_OPTIONS_LIMIT = 50;

export interface LookupOption {
  key: string;
  /** The stored key as the target row has it (a number stays a number). */
  raw: unknown;
  label: string;
  row: Row;
}

export interface LookupOptionsResult {
  options: LookupOption[];
  /** The target's row count for this search; more than `LOOKUP_OPTIONS_LIMIT` means "type to narrow". */
  total: number | null;
  isLoading: boolean;
  error: Error | null;
}

/** The search condition of a picker: `label_field contains <search>`, case-insensitive. */
export function optionsFilter(lookup: LookupDef, search: string): FilterNode | undefined {
  const s = search.trim();
  return s
    ? { field: lookup.label_field, op: "contains", value: s, case_insensitive: true }
    : undefined;
}

/**
 * The first `LOOKUP_OPTIONS_LIMIT` rows of a lookup's target, by
 * `label_field`, narrowed by `search` (`contains` on `label_field`). A
 * picker shows its search box once `total` (of the empty search) is larger
 * than the limit.
 */
export function useLookupOptions(
  lookup: LookupDef | undefined,
  search: string,
  opts: { enabled?: boolean } = {},
): LookupOptionsResult {
  const client = useUdcClient();
  const target = lookup ?? { collection: "", label_field: "" };
  const filter = optionsFilter(target, search);
  const enabled = (opts.enabled ?? true) && lookup !== undefined;
  useUdcChangesMany([target.collection], { enabled });
  const q = useQuery({
    queryKey: udcKeys.lookupOptions(target.collection, target.label_field, search.trim()),
    queryFn: ({ signal }) =>
      client.list(
        {
          collection: target.collection,
          ...(filter ? { filter } : {}),
          sort: [{ field: target.label_field, dir: "asc" }],
          page: { limit: LOOKUP_OPTIONS_LIMIT },
        },
        { signal },
      ),
    enabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const options = (q.data?.rows ?? []).map((row) => {
    const raw = lookupKeyOf(row, target);
    const key = keyString(raw);
    return { key, raw, label: lookupLabel(row, target) ?? key, row };
  });
  return { options, total: q.data?.total ?? null, isLoading: q.isLoading, error: q.error };
}
