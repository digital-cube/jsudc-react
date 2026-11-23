import { type FilterNode, type SortKey, SortKeySchema, type ViewConfig } from "@jsudc/core";
import { useCallback, useMemo } from "react";
import { storage } from "../lib/storage.js";
import { useRendererRegistry } from "../renderers/context.js";
import { resolveTab } from "../renderers/registry.js";
import type { RendererRegistry } from "../renderers/types.js";
import type { PagingMode } from "../udc/keys.js";
import { useUrlSearchParams } from "../url-state/UrlState.js";
import {
  type ChipState,
  decodeChipParam,
  decodeFilterParam,
  decodeModeParam,
  decodePageParam,
  decodeSortParam,
  encodeChipParam,
  encodeFilterParam,
  encodeSortParam,
  PARAM,
} from "./urlState.js";

export const pagingStorageKey = (collection: string) => `udc:paging:${collection}`;

/** URL `?mode=` wins, then the user's last choice for this collection, then the view. */
export function resolvePagingMode(
  urlMode: PagingMode | null,
  stored: string | null,
  viewDefault: PagingMode,
): PagingMode {
  if (urlMode) return urlMode;
  return stored === "pages" || stored === "infinite" ? stored : viewDefault;
}

/**
 * The view's `default_sort` (`@jsudc/core` 0.6.0), `[]` when it has none. Read loosely, so that
 * a core of 0.5.0 (whose `ViewConfig` type lacks the key, but whose loose parse keeps it) works
 * as well; an ill-formed value reads as none.
 */
export function viewDefaultSort(view: ViewConfig | undefined): SortKey[] {
  const raw = (view as { default_sort?: unknown } | undefined)?.default_sort;
  const parsed = SortKeySchema.array().safeParse(raw);
  return parsed.success ? parsed.data : [];
}

/**
 * The sort the view loads with. A `sort` in the URL state wins, even an empty one (`sort=`, the
 * user's "no sort"). Without it, the default; while a search answered by the source is typed the
 * default steps aside, so the rows come best match first.
 */
export function resolveSort(
  rawSort: string | null,
  defaultSort: readonly SortKey[],
  stepAside: boolean,
): SortKey[] {
  if (rawSort !== null) return decodeSortParam(rawSort);
  return stepAside ? [] : [...defaultSort];
}

/**
 * What `setSort` writes: `null` removes the parameter. With a default, the default itself is not
 * written (an absent `sort` means it), and "no sort" is written as an empty `sort=` so that the
 * default does not come back; while the default steps aside for a source search, an absent `sort`
 * is what lets it return once the search is cleared.
 */
export function sortParamFor(
  sort: readonly SortKey[],
  defaultSort: readonly SortKey[],
  stepAside: boolean,
): string | null {
  const enc = encodeSortParam(sort);
  const def = encodeSortParam(defaultSort);
  if (def === null || stepAside) return enc;
  if (enc === def) return null;
  return enc ?? "";
}

export interface DataViewState {
  tab: string;
  search: string;
  chips: ChipState;
  tree: FilterNode | null;
  sort: SortKey[];
  mode: PagingMode;
  page: number;
  setTab: (tab: string) => void;
  setSearch: (q: string) => void;
  setChips: (chips: ChipState) => void;
  setTree: (tree: FilterNode | null) => void;
  setSort: (sort: SortKey[]) => void;
  setMode: (mode: PagingMode) => void;
  setPage: (page: number) => void;
  clearFilters: () => void;
}

/**
 * Everything the data view lets the user choose, kept in the address bar
 * (replace, not push: a filter tweak is not a history entry). A change to
 * what the rows are (search, chips, tree, sort) drops `?p=` back to page 1.
 */
/** The pseudo-tab of a collection's README; offered when `describe.docs` has text. */
export const DOC_TAB = "doc";

/** The pseudo-tab of the file a collection is read from; offered when `capabilities.source_yaml`. */
export const SOURCE_TAB = "source";

export function useDataViewState(
  collection: string,
  view: ViewConfig | undefined,
  opts: {
    doc?: boolean;
    source?: boolean;
    /** The renderers a tab may resolve to; the provider's registry when absent. */
    renderers?: RendererRegistry;
    /** The paging mode to open in, instead of the view's `pagination`. */
    mode?: PagingMode;
    /**
     * The user cannot choose the paging mode (the toggle is not drawn): `mode`,
     * else the view's `pagination`, is the mode; `?mode=` and the choice
     * remembered from an earlier session are ignored.
     */
    fixedMode?: boolean;
    /**
     * The order the rows come in while the URL state has no `sort`: the host's (`UdcDataView
     * defaultSort`), else the view's `default_sort`. Not written into the URL.
     */
    defaultSort?: readonly SortKey[] | undefined;
    /**
     * The source answers search itself (`capabilities.search: "source"`): while a search is typed
     * the default sort steps aside, so the source answers in relevance order.
     */
    sourceSearch?: boolean;
  } = {},
): DataViewState {
  const [params, setParams] = useUrlSearchParams();
  const provided = useRendererRegistry();
  const registry = opts.renderers ?? provided;

  const update = useCallback(
    (edit: (p: URLSearchParams) => void, resetPage = false) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          edit(next);
          if (resetPage) next.delete(PARAM.page);
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  const setOrDelete = (p: URLSearchParams, key: string, v: string | null) =>
    v ? p.set(key, v) : p.delete(key);

  const raw = {
    tab: params.get(PARAM.tab),
    q: params.get(PARAM.search),
    cf: params.get(PARAM.chips),
    f: params.get(PARAM.filter),
    sort: params.get(PARAM.sort),
    mode: params.get(PARAM.mode),
    p: params.get(PARAM.page),
  };

  const chips = useMemo(() => decodeChipParam(raw.cf), [raw.cf]);
  const tree = useMemo(() => decodeFilterParam(raw.f), [raw.f]);
  const defaultSort = opts.defaultSort ?? viewDefaultSort(view);
  const defaultKey = encodeSortParam(defaultSort);
  const stepAside = opts.sourceSearch === true && (raw.q ?? "").trim() !== "";
  // biome-ignore lint/correctness/useExhaustiveDependencies: defaultKey stands for defaultSort.
  const sort = useMemo(
    () => resolveSort(raw.sort, defaultSort, stepAside),
    [raw.sort, defaultKey, stepAside],
  );

  const renderers = view?.available_renderers ?? ["table"];
  // The Doc and Source tabs are chosen, never the default: the view's default_renderer opens.
  const tab =
    opts.doc && raw.tab === DOC_TAB
      ? DOC_TAB
      : opts.source && raw.tab === SOURCE_TAB
        ? SOURCE_TAB
        : resolveTab(registry, raw.tab ?? "", renderers, view?.default_renderer ?? "table");
  const defaultMode = opts.mode ?? view?.pagination ?? "infinite";
  const mode = opts.fixedMode
    ? defaultMode
    : resolvePagingMode(
        decodeModeParam(raw.mode),
        storage.get(pagingStorageKey(collection)),
        defaultMode,
      );

  return {
    tab,
    search: raw.q ?? "",
    chips,
    tree,
    sort,
    mode,
    page: mode === "pages" ? decodePageParam(raw.p) : 1,
    setTab: (v) => update((p) => p.set(PARAM.tab, v)),
    setSearch: (q) => update((p) => setOrDelete(p, PARAM.search, q.trim() ? q : null), true),
    setChips: (c) => update((p) => setOrDelete(p, PARAM.chips, encodeChipParam(c)), true),
    setTree: (t) => update((p) => setOrDelete(p, PARAM.filter, encodeFilterParam(t)), true),
    setSort: (s) =>
      update((p) => {
        const v = sortParamFor(s, defaultSort, stepAside);
        if (v === null) p.delete(PARAM.sort);
        else p.set(PARAM.sort, v);
      }, true),
    setMode: (m) => {
      storage.set(pagingStorageKey(collection), m);
      update((p) => {
        p.set(PARAM.mode, m);
        if (m === "infinite") p.delete(PARAM.page);
      });
    },
    setPage: (n) => update((p) => setOrDelete(p, PARAM.page, n > 1 ? String(n) : null)),
    clearFilters: () =>
      update((p) => {
        p.delete(PARAM.search);
        p.delete(PARAM.chips);
        p.delete(PARAM.filter);
      }, true),
  };
}
