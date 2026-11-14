import type { FilterNode, SortKey } from "@jsudc/core";

export type PagingMode = "infinite" | "pages";

export interface ListKeyParams {
  filter: FilterNode | undefined;
  sort: SortKey[];
  limit: number;
  /** `all`: every row up to `limit`, fetched page by page into one list (`useUdcAllRows`). */
  mode: PagingMode | "all";
  page?: number;
}

/** Every query this app makes sits under `["udc", ...]`. */
export const udcKeys = {
  all: ["udc"] as const,
  collections: () => ["udc", "collections"] as const,
  describe: (collection: string) => ["udc", "describe", collection] as const,
  source: (collection: string) => ["udc", "source", collection] as const,
  lists: (collection: string) => ["udc", "list", collection] as const,
  list: (collection: string, params: ListKeyParams) => ["udc", "list", collection, params] as const,
  lookups: (collection: string) => ["udc", "lookup", collection] as const,
  /** One lookup batch: the target collection, its sorted keys, and the key field when not `id`. */
  lookup: (collection: string, sortedKeys: readonly string[], keyField = "id") =>
    keyField === "id"
      ? (["udc", "lookup", collection, sortedKeys] as const)
      : (["udc", "lookup", collection, sortedKeys, keyField] as const),
  /** The options of a lookup picker (a chip, the inline editor): target, label field, search. */
  lookupOptions: (collection: string, labelField: string, search: string) =>
    ["udc", "lookup-options", collection, labelField, search] as const,
};
