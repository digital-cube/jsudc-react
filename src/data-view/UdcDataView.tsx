import type { FilterChipConfig, FilterNode, Row } from "@jsudc/core";
import { BookOpen, FileCode2, InfinityIcon, Rows3 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChartWindowControl } from "../chart/ChartWindowControl";
import { useChartWindow } from "../chart/useChartWindow";
import { andWindow } from "../chart/window";
import { schemaLabelTerms, tableSection, useI18n } from "../i18n/i18n";
import { cn, humanize } from "../lib/utils";
import { useRendererRegistry } from "../renderers/context";
import { rendererEntry, rendererTabs } from "../renderers/registry";
import type { FolderNav, RendererCount, RendererRegistry } from "../renderers/types";
import { useSchemaEditor } from "../schema-editor/useSchemaEditor";
import { ErrorState, NoRendererState } from "../table/states";
import { useUdcCollection, useUdcDescribe } from "../udc/hooks";
import type { PagingMode } from "../udc/keys";
import { useUiKit } from "../ui-kit/context";
import { composeFilter } from "./compose";
import { DocTab } from "./DocTab";
import { FilePreview } from "./FilePreview";
import { FilterBuilder, FilterPills } from "./FilterBuilder";
import { FilterChips } from "./FilterChips";
import { FolderBar } from "./FolderBar";
import { Freshness } from "./Freshness";
import { joinFolder, splitFolder } from "./folder";
import { liveDescribe, liveSort, pruneTree } from "./liveView";
import { SearchBox } from "./SearchBox";
import { SourceTab } from "./SourceTab";
import { cycleSort } from "./urlState";
import { DOC_TAB, SOURCE_TAB, useDataViewState } from "./useDataViewState";

/**
 * One collection: toolbar (search, chips, filter builder, paging mode, count,
 * renderer tabs) over the active renderer. Everything the user picks lives
 * in the URL (see `useDataViewState`).
 */
export interface UdcDataViewProps {
  collection: string;
  /** The renderers this view draws its tabs with; the provider's registry when absent. */
  renderers?: RendererRegistry;
}

export function UdcDataView({ collection, renderers }: UdcDataViewProps) {
  const provided = useRendererRegistry();
  const registry = renderers ?? provided;
  const { Button, Segmented, Skeleton } = useUiKit();
  const { t, tMaybe, locale, intlLocale, setSectionTerms } = useI18n();
  const describe = useUdcDescribe(collection);
  // Soft-deleted fields leave the chips, search, cards and any sort or filter in the URL.
  const live = useMemo(
    () => (describe.data ? liveDescribe(describe.data) : undefined),
    [describe.data],
  );
  const view = live?.view;
  const schema = live?.schema;
  // The README in the UI's language, else the English one.
  const docs: Partial<Record<string, string>> | undefined = live?.docs;
  const docText = docs?.[locale] ?? docs?.en;
  const hasSource = live?.capabilities.source_yaml === true;
  const state = useDataViewState(collection, view, {
    doc: Boolean(docText),
    source: hasSource,
    renderers: registry,
  });
  // The README and the source file are pages of their own: no rows, no toolbar.
  const onSource = state.tab === SOURCE_TAB;
  const onDoc = state.tab === DOC_TAB;
  const onPage = onDoc || onSource;
  const section = tableSection(collection);

  // Labels typed in the field form live in the schema; the headers read them through i18n.
  useEffect(() => {
    if (schema) setSectionTerms(section, schemaLabelTerms(schema));
  }, [schema, section, setSectionTerms]);

  const sort = useMemo(
    () => (schema ? liveSort(state.sort, schema) : state.sort),
    [state.sort, schema],
  );
  const tree = useMemo(
    () => (schema ? pruneTree(state.tree, schema) : state.tree),
    [state.tree, schema],
  );

  // A folder listing: the open folder is a condition of the tree, shown as the breadcrumb
  // instead of a filter pill; the builder and the pills edit the rest of the tree.
  const folderOpts = view?.folder_options;
  const { folder, rest: userTree } = useMemo(
    () => (folderOpts ? splitFolder(tree, folderOpts.path_field) : { folder: null, rest: tree }),
    [tree, folderOpts],
  );
  const { setTree } = state;
  const setUserTree = useCallback(
    (next: FilterNode | null) =>
      setTree(folderOpts ? joinFolder(next, folderOpts.path_field, folder) : next),
    [setTree, folderOpts, folder],
  );
  const [previewRow, setPreviewRow] = useState<Row | null>(null);
  const folderNav = useMemo<FolderNav | undefined>(
    () =>
      folderOpts
        ? {
            options: folderOpts,
            open: (path) => setTree(joinFolder(userTree, folderOpts.path_field, path || null)),
            openFile: folderOpts.preview ? setPreviewRow : undefined,
          }
        : undefined,
    [folderOpts, userTree, setTree],
  );

  const userFilter = useMemo(
    () =>
      composeFilter({
        search: state.search,
        searchConfig: view?.search,
        chips: state.chips,
        chipConfigs: view?.filters,
        tree,
      }),
    [state.search, state.chips, tree, view?.search, view?.filters],
  );
  const userBaseFilter = useMemo(
    () =>
      composeFilter({
        search: "",
        searchConfig: view?.search,
        chips: state.chips,
        chipConfigs: view?.filters,
        tree,
      }),
    [state.chips, tree, view?.search, view?.filters],
  );

  // A chart window applies on the chart tab (its default preset), and on every tab of the view
  // once the URL picked one, so the table shows the rows the chart draws.
  const win = useChartWindow(view);
  const onChart = state.tab === "chart";
  const chartWindow = win && !onPage && (onChart || win.explicit) ? win : undefined;
  const windowCond = chartWindow?.cond;
  const filter = useMemo(() => andWindow(userFilter, windowCond), [userFilter, windowCond]);
  const baseFilter = useMemo(
    () => andWindow(userBaseFilter, windowCond),
    [userBaseFilter, windowCond],
  );

  const entry = onPage ? undefined : rendererEntry(registry, state.tab);
  const paging = !onPage && (entry?.paging ?? true);
  // A renderer without paging loads its own rows; the count it reports replaces the list's.
  const [ownCount, setOwnCount] = useState<RendererCount | null>(null);

  const limit = view?.page_size_default ?? 50;
  const data = useUdcCollection({
    collection,
    filter,
    sort,
    mode: state.mode,
    pageLimit: limit,
    page: state.page,
    enabled: describe.isSuccess && paging,
    capabilities: live?.capabilities,
    refetchInterval: view?.refresh_interval_ms,
  });

  const fieldLabel = useCallback((field: string) => t(section, field), [t, section]);
  const chipLabel = useCallback(
    (cfg: FilterChipConfig) => tMaybe(section, cfg.field) ?? cfg.label ?? humanize(cfg.field),
    [tMaybe, section],
  );
  const { setSearch } = state;
  const onSearch = useCallback((q: string) => setSearch(q), [setSearch]);
  const editor = useSchemaEditor({ collection, schema, fieldLabel });

  const title = t("COLLECTIONS", collection);
  const description = tMaybe(section, "__DESCRIPTION");

  if (describe.error) {
    return (
      <div className="udc:flex udc:flex-1 udc:items-center udc:justify-center">
        <ErrorState error={describe.error} onRetry={() => void describe.refetch()} />
      </div>
    );
  }

  // The window is not a filter the user can clear: "clear filters" leaves it.
  const filtered = userFilter !== undefined;
  const fmt = (n: number) => new Intl.NumberFormat(intlLocale).format(n);
  const shown = paging ? data.rows.length : (ownCount?.shown ?? 0);
  const total = paging ? data.total : (ownCount?.total ?? null);
  const fetchedAt = paging ? data.fetchedAt : (ownCount?.fetchedAt ?? null);
  const stale = paging ? data.stale : ownCount?.stale === true;
  const tabs = view
    ? [
        ...(docText ? [{ name: DOC_TAB, entry: undefined, doc: true }] : []),
        ...rendererTabs(registry, view.available_renderers).map((tab) => ({ ...tab, doc: false })),
        ...(hasSource ? [{ name: SOURCE_TAB, entry: undefined, doc: true }] : []),
      ]
    : [];
  const resetKey = JSON.stringify([filter ?? null, sort, state.mode]);

  return (
    <div
      className="udc-data-view udc:flex udc:min-h-0 udc:flex-1 udc:flex-col"
      data-testid="data-view"
      data-collection={collection}
    >
      <header className="udc:flex udc:flex-wrap udc:items-end udc:justify-between udc:gap-x-6 udc:gap-y-2 udc:px-6 udc:pt-5 udc:pb-4">
        <div className="udc:min-w-0">
          <h1 className="udc:text-lg udc:font-semibold udc:tracking-tight">{title}</h1>
          {description ? (
            <p className="udc:text-[13px] udc:text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <div className="udc:flex udc:flex-wrap udc:items-center udc:gap-2">
          {view && paging ? (
            <Segmented<PagingMode>
              aria-label={t("APP", "PAGING")}
              data-testid="paging-toggle"
              value={state.mode}
              onChange={state.setMode}
              options={[
                {
                  value: "pages",
                  testId: "paging-pages",
                  label: (
                    <>
                      <Rows3 />
                      {t("APP", "PAGING_PAGES")}
                    </>
                  ),
                },
                {
                  value: "infinite",
                  testId: "paging-infinite",
                  label: (
                    <>
                      <InfinityIcon />
                      {t("APP", "PAGING_INFINITE")}
                    </>
                  ),
                },
              ]}
            />
          ) : null}
          {view && paging && tabs.length > 1 ? (
            <span aria-hidden className="udc:mx-1 udc:h-5 udc:w-px udc:bg-border-strong/70" />
          ) : null}
          {view && tabs.length > 1 ? (
            <Segmented
              aria-label="Renderer"
              data-testid="tab-switch"
              value={state.tab}
              onChange={state.setTab}
              options={tabs.map(({ name, entry: e, doc }) => {
                if (doc) {
                  const PageIcon = name === SOURCE_TAB ? FileCode2 : BookOpen;
                  return {
                    value: name,
                    testId: `tab-${name}`,
                    label: (
                      <>
                        <PageIcon />
                        {t("APP", name === SOURCE_TAB ? "TAB_SOURCE" : "TAB_DOC")}
                      </>
                    ),
                  };
                }
                const Icon = e?.icon;
                return {
                  value: name,
                  testId: `tab-${name}`,
                  disabled: e === undefined,
                  ...(e ? {} : { tooltip: t("APP", "TAB_UNAVAILABLE", { name }) }),
                  label: (
                    <>
                      {Icon ? <Icon /> : null}
                      {e ? t("APP", e.labelKey) : (tMaybe("APP", `TAB_${name}`) ?? humanize(name))}
                    </>
                  ),
                };
              })}
            />
          ) : null}
        </div>
      </header>

      <div className="udc:mx-6 udc:mb-6 udc:flex udc:min-h-0 udc:flex-1 udc:flex-col udc:overflow-hidden udc:rounded-xl udc:border udc:border-border udc:bg-surface udc:shadow-sm udc:shadow-black/[0.03]">
        <div
          data-testid="toolbar"
          className={cn(
            "udc-toolbar",
            onPage
              ? "udc:hidden"
              : "udc:flex udc:flex-wrap udc:items-center udc:gap-2 udc:border-b udc:border-border udc:px-3 udc:py-2.5",
          )}
        >
          {view ? (
            <>
              {/* A view without a `search` block has nothing to search: no box. */}
              {view.search ? (
                <SearchBox
                  value={state.search}
                  onChange={onSearch}
                  placeholder={
                    tMaybe(section, "SEARCH_PLACEHOLDER") ??
                    view.search.placeholder ??
                    t("APP", "SEARCH")
                  }
                />
              ) : null}
              {/* Its natural width: on a narrow screen the chips wrap as one group, under the search. */}
              <div className="udc:flex udc:flex-wrap udc:items-center udc:gap-1.5">
                {view.filters?.length ? (
                  <FilterChips
                    configs={view.filters}
                    state={state.chips}
                    onChange={state.setChips}
                    label={chipLabel}
                  />
                ) : null}
                {live?.filterable.fields.length ? (
                  <FilterBuilder
                    fields={live.filterable.fields}
                    tree={userTree}
                    onChange={setUserTree}
                    fieldLabel={fieldLabel}
                  />
                ) : null}
              </div>
              <div className="udc:ml-auto udc:flex udc:items-center udc:gap-2">
                {entry?.toolbar && live ? (
                  <entry.toolbar collection={collection} describe={live} />
                ) : null}
                {chartWindow ? <ChartWindowControl win={chartWindow} clearable={!onChart} /> : null}
                <Freshness fetchedAt={fetchedAt} stale={stale} source={live?.source} />
                <span
                  className="udc:text-xs udc:whitespace-nowrap udc:text-muted-foreground udc:tabular-nums"
                  data-testid="row-count"
                  data-shown={shown}
                  data-total={total ?? undefined}
                >
                  {total === null ? (
                    <Skeleton className="udc:h-3 udc:w-24" />
                  ) : ownCount?.unit === "nodes" && !paging ? (
                    shown === total ? (
                      t("APP", "TREE_NODES", { count: fmt(total) })
                    ) : (
                      t("APP", "TREE_NODES_OF", { shown: fmt(shown), total: fmt(total) })
                    )
                  ) : ownCount?.unit === "map" && !paging ? (
                    t("APP", "MAP_ON_MAP", { shown: fmt(shown), total: fmt(total) })
                  ) : ownCount?.unit === "chart" && !paging ? (
                    t("APP", "CHART_IN_WINDOW", { shown: fmt(shown), total: fmt(total) })
                  ) : (
                    t("APP", "SHOWING", { shown: fmt(shown), total: fmt(total) })
                  )}
                </span>
              </div>
            </>
          ) : (
            <>
              <Skeleton className="udc:h-8 udc:w-80" />
              <Skeleton className="udc:h-7 udc:w-20 udc:rounded-full" />
              <Skeleton className="udc:h-7 udc:w-24 udc:rounded-full" />
            </>
          )}
        </div>

        {live && userTree && !onPage ? (
          <div
            data-testid="filter-pills"
            className="udc:flex udc:flex-wrap udc:items-center udc:gap-1.5 udc:border-b udc:border-border udc:bg-muted/40 udc:px-3 udc:py-2"
          >
            <FilterPills
              fields={live.filterable.fields}
              tree={userTree}
              onChange={setUserTree}
              fieldLabel={fieldLabel}
            />
            <Button
              size="sm"
              variant="ghost"
              className="udc:ml-auto"
              onClick={() => setUserTree(null)}
            >
              {t("APP", "CLEAR")}
            </Button>
          </div>
        ) : null}

        {folderNav && !onPage ? <FolderBar folder={folder} onOpen={folderNav.open} /> : null}

        {live && onDoc && docText ? (
          <DocTab markdown={docText} />
        ) : live && onSource ? (
          <SourceTab collection={collection} />
        ) : live && entry ? (
          <entry.component
            key={state.tab}
            collection={collection}
            describe={live}
            data={data}
            filter={filter}
            baseFilter={baseFilter}
            chartWindow={chartWindow}
            unwindowedFilter={userFilter}
            search={state.search}
            sort={sort}
            onSort={(field, multi) => state.setSort(cycleSort(sort, field, multi))}
            mode={state.mode}
            page={state.page}
            limit={limit}
            onPage={state.setPage}
            filtered={filtered}
            onClearFilters={state.clearFilters}
            resetKey={resetKey}
            onSchemaAction={
              entry.editMode && live.capabilities.schema_edit ? editor.open : undefined
            }
            onCount={setOwnCount}
            folder={folderNav}
          />
        ) : live ? (
          <NoRendererState name={state.tab} />
        ) : (
          <div className="udc:flex udc:flex-col udc:gap-3 udc:p-4">
            {Array.from({ length: 10 }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: placeholders
              <Skeleton key={i} className="udc:h-6" />
            ))}
          </div>
        )}
      </div>
      {editor.dialogs}
      {folderOpts?.preview ? (
        <FilePreview
          collection={collection}
          row={previewRow}
          pathField={folderOpts.path_field}
          onClose={() => setPreviewRow(null)}
        />
      ) : null}
    </div>
  );
}
