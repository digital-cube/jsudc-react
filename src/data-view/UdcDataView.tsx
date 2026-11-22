import type { FilterChipConfig, FilterNode, Row } from "@jsudc/core";
import { BookOpen, FileCode2, InfinityIcon, Rows3 } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { ChartWindowControl } from "../chart/ChartWindowControl.js";
import { useChartWindow } from "../chart/useChartWindow.js";
import { andWindow } from "../chart/window.js";
import { schemaLabelTerms, tableSection, useI18n } from "../i18n/i18n.js";
import { cn, humanize } from "../lib/utils.js";
import { useRendererRegistry } from "../renderers/context.js";
import { rendererEntry, rendererTabs, resolveTab } from "../renderers/registry.js";
import type { FolderNav, RendererCount, RendererRegistry } from "../renderers/types.js";
import { useSchemaEditor } from "../schema-editor/useSchemaEditor.js";
import { ErrorState, NoRendererState } from "../table/states.js";
import { useUdcCollection, useUdcDescribe } from "../udc/hooks.js";
import type { PagingMode } from "../udc/keys.js";
import { useUiKit } from "../ui-kit/context.js";
import type { UrlStateAdapter } from "../url-state/adapter.js";
import { createMemoryUrlStateAdapter, prefixUrlStateAdapter } from "../url-state/adapters.js";
import { UdcUrlStateProvider, useUrlStateAdapter } from "../url-state/UrlState.js";
import { composeFilter } from "./compose.js";
import { DocTab } from "./DocTab.js";
import { FilePreview } from "./FilePreview.js";
import { FilterBuilder, FilterPills } from "./FilterBuilder.js";
import { FilterChips } from "./FilterChips.js";
import { FolderBar } from "./FolderBar.js";
import { Freshness } from "./Freshness.js";
import { joinFolder, splitFolder } from "./folder.js";
import { liveDescribe, liveSort, pruneTree } from "./liveView.js";
import { SearchBox } from "./SearchBox.js";
import { SourceTab } from "./SourceTab.js";
import { cycleSort } from "./urlState.js";
import { DOC_TAB, SOURCE_TAB, useDataViewState } from "./useDataViewState.js";

/**
 * One collection: toolbar (search, chips, filter builder, paging mode, count,
 * renderer tabs) over the active renderer. Everything the user picks lives
 * in the URL (see `useDataViewState`).
 */
export interface UdcDataViewProps {
  collection: string;
  /** The renderers this view draws its tabs with; the provider's registry when absent. */
  renderers?: RendererRegistry;
  /**
   * A filter of the host's (the open folder of a mail client): ANDed into every
   * list the view and its renderers load, counted in "of M", but not shown as a
   * chip or pill, not written to the URL, not removed by "clear filters" and not
   * "the user filtered" for the empty state.
   */
  filter?: FilterNode | undefined;
  /** Which parts of the view's frame are drawn: everything by default. See `UdcDataViewChrome`. */
  chrome?: UdcDataViewChromePreset | UdcDataViewChrome | undefined;
  /** The paging mode to open in, instead of the view's `pagination`. */
  pagingMode?: PagingMode | undefined;
  /** Host content at the start of the toolbar, before the search box. */
  toolbarStart?: ReactNode;
  /** Host content at the end of the toolbar, after the row count. */
  toolbarEnd?: ReactNode;
  /**
   * Where the view keeps its state (search, chips, filter, sort, paging, tab, and
   * the kanban board, chart window and calendar range of its renderers):
   * `"url"` (default) the adapter in effect (`UdcUrlStateProvider`, else the
   * address bar); `"memory"` a store of this view's own that never touches the
   * address bar; or any `UrlStateAdapter`.
   */
  urlState?: "url" | "memory" | UrlStateAdapter | undefined;
  /**
   * A prefix for every parameter the view and its renderers read and write
   * (`inbox.` → `?inbox.q=…&inbox.sort=…`): other parameters are neither read
   * nor removed, so two views, or a view and a host route with a `q` of its
   * own, share one query string. End it with a separator.
   */
  urlPrefix?: string | undefined;
}

/** `full`: today's view, every part drawn. `embedded`: one pane of a host's screen, no part drawn. */
export type UdcDataViewChromePreset = "full" | "embedded";

/**
 * The view's frame, part by part: `true` draws the part. A flag left out takes
 * the preset's value (`full`: all `true`; `embedded`: all `false`).
 */
export interface UdcDataViewChrome {
  preset?: UdcDataViewChromePreset;
  /** The title and description above the toolbar. */
  header?: boolean;
  /** The renderer tabs (table, cards, kanban, …). */
  tabs?: boolean;
  /**
   * The pages / infinite toggle. Without it the mode is the `pagingMode` prop,
   * else the view's `pagination`, never a choice stored by an earlier session.
   */
  pagingToggle?: boolean;
  /** The Doc pseudo-tab (the collection's README). */
  docTab?: boolean;
  /** The Source pseudo-tab (the collection's source file). */
  sourceTab?: boolean;
  /** The card around the toolbar and rows: its border, shadow, rounding and outer margins. */
  frame?: boolean;
}

/** Every flag of `chrome` resolved against its preset. */
export function resolveChrome(
  chrome: UdcDataViewChromePreset | UdcDataViewChrome | undefined,
): Required<Omit<UdcDataViewChrome, "preset">> {
  const flags: UdcDataViewChrome = typeof chrome === "string" ? { preset: chrome } : (chrome ?? {});
  const on = flags.preset !== "embedded";
  return {
    header: flags.header ?? on,
    tabs: flags.tabs ?? on,
    pagingToggle: flags.pagingToggle ?? on,
    docTab: flags.docTab ?? on,
    sourceTab: flags.sourceTab ?? on,
    frame: flags.frame ?? on,
  };
}

/** `a AND b AND …` of the parts that are set; `undefined` when none is. */
function andAll(...parts: (FilterNode | undefined)[]): FilterNode | undefined {
  const set = parts.filter((p): p is FilterNode => p !== undefined);
  if (set.length <= 1) return set[0];
  return { and: set };
}

export function UdcDataView(props: UdcDataViewProps) {
  const { urlState, urlPrefix } = props;
  const inEffect = useUrlStateAdapter();
  // One memory store per mounted view; created even when unused, it costs an object.
  const [memory] = useState(createMemoryUrlStateAdapter);
  const base =
    urlState === "memory" ? memory : urlState && urlState !== "url" ? urlState : inEffect;
  const adapter = useMemo(
    () => (urlPrefix ? prefixUrlStateAdapter(base, urlPrefix) : base),
    [base, urlPrefix],
  );
  // Without either prop the tree is exactly today's: no provider of its own.
  if (adapter === inEffect) return <DataViewBody {...props} />;
  return (
    <UdcUrlStateProvider adapter={adapter}>
      <DataViewBody {...props} />
    </UdcUrlStateProvider>
  );
}

function DataViewBody({
  collection,
  renderers,
  filter: hostFilterProp,
  chrome: chromeProp,
  pagingMode,
  toolbarStart,
  toolbarEnd,
}: UdcDataViewProps) {
  const chrome = resolveChrome(chromeProp);
  // A host passing a new but equal filter object each render keeps the same filter.
  const hostKey = JSON.stringify(hostFilterProp ?? null);
  const hostFilter = useMemo<FilterNode | undefined>(
    () => (hostKey === "null" ? undefined : (JSON.parse(hostKey) as FilterNode)),
    [hostKey],
  );
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
  const docOn = Boolean(docText) && chrome.docTab;
  const sourceOn = hasSource && chrome.sourceTab;
  const state = useDataViewState(collection, view, {
    doc: docOn,
    source: sourceOn,
    renderers: registry,
    ...(pagingMode ? { mode: pagingMode } : {}),
    ...(chrome.pagingToggle ? {} : { fixedMode: true }),
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
  // The host's filter is ANDed into every list, under whatever the user picked.
  const unwindowedFilter = useMemo(() => andAll(hostFilter, userFilter), [hostFilter, userFilter]);
  const filter = useMemo(
    () => andWindow(unwindowedFilter, windowCond),
    [unwindowedFilter, windowCond],
  );
  const baseFilter = useMemo(
    () => andWindow(andAll(hostFilter, userBaseFilter), windowCond),
    [hostFilter, userBaseFilter, windowCond],
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

  // The window and the host's filter are not filters the user can clear: "clear filters" leaves them.
  const filtered = userFilter !== undefined;
  const fmt = (n: number) => new Intl.NumberFormat(intlLocale).format(n);
  const shown = paging ? data.rows.length : (ownCount?.shown ?? 0);
  const total = paging ? data.total : (ownCount?.total ?? null);
  const fetchedAt = paging ? data.fetchedAt : (ownCount?.fetchedAt ?? null);
  const stale = paging ? data.stale : ownCount?.stale === true;
  // Without the renderer tabs, a Doc or Source tab still needs a way back: the renderer in use.
  const rendererNames = view
    ? chrome.tabs
      ? view.available_renderers
      : [
          onPage
            ? resolveTab(registry, "", view.available_renderers, view.default_renderer ?? "table")
            : state.tab,
        ]
    : [];
  const tabs = view
    ? [
        ...(docOn ? [{ name: DOC_TAB, entry: undefined, doc: true }] : []),
        ...rendererTabs(registry, rendererNames).map((tab) => ({ ...tab, doc: false })),
        ...(sourceOn ? [{ name: SOURCE_TAB, entry: undefined, doc: true }] : []),
      ]
    : [];
  const showToggle = Boolean(view) && paging && chrome.pagingToggle;
  const showTabs = Boolean(view) && tabs.length > 1;
  const resetKey = JSON.stringify([filter ?? null, sort, state.mode]);

  return (
    <div
      className="udc-data-view udc:flex udc:min-h-0 udc:flex-1 udc:flex-col"
      data-testid="data-view"
      data-collection={collection}
    >
      {chrome.header || showToggle || showTabs ? (
        <header className="udc:flex udc:flex-wrap udc:items-end udc:justify-between udc:gap-x-6 udc:gap-y-2 udc:px-6 udc:pt-5 udc:pb-4">
          {chrome.header ? (
            <div className="udc:min-w-0" data-testid="data-view-title">
              <h1 className="udc:text-lg udc:font-semibold udc:tracking-tight">{title}</h1>
              {description ? (
                <p className="udc:text-[13px] udc:text-muted-foreground">{description}</p>
              ) : null}
            </div>
          ) : null}
          <div
            className={cn(
              "udc:flex udc:flex-wrap udc:items-center udc:gap-2",
              !chrome.header && "udc:ml-auto",
            )}
          >
            {showToggle ? (
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
            {showToggle && showTabs ? (
              <span aria-hidden className="udc:mx-1 udc:h-5 udc:w-px udc:bg-border-strong/70" />
            ) : null}
            {showTabs ? (
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
                        {e
                          ? t("APP", e.labelKey)
                          : (tMaybe("APP", `TAB_${name}`) ?? humanize(name))}
                      </>
                    ),
                  };
                })}
              />
            ) : null}
          </div>
        </header>
      ) : null}

      <div
        data-testid="data-view-frame"
        data-framed={chrome.frame}
        className={
          chrome.frame
            ? "udc:mx-6 udc:mb-6 udc:flex udc:min-h-0 udc:flex-1 udc:flex-col udc:overflow-hidden udc:rounded-xl udc:border udc:border-border udc:bg-surface udc:shadow-sm udc:shadow-black/[0.03]"
            : "udc:flex udc:min-h-0 udc:flex-1 udc:flex-col udc:overflow-hidden"
        }
      >
        <div
          data-testid="toolbar"
          className={cn(
            "udc-toolbar",
            onPage
              ? "udc:hidden"
              : "udc:flex udc:flex-wrap udc:items-center udc:gap-2 udc:border-b udc:border-border udc:px-3 udc:py-2.5",
          )}
        >
          {toolbarStart != null && toolbarStart !== false ? (
            <div data-testid="toolbar-start" className="udc:flex udc:items-center udc:gap-2">
              {toolbarStart}
            </div>
          ) : null}
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
                    schema={schema}
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
          {toolbarEnd != null && toolbarEnd !== false ? (
            <div
              data-testid="toolbar-end"
              className={cn("udc:flex udc:items-center udc:gap-2", !view && "udc:ml-auto")}
            >
              {toolbarEnd}
            </div>
          ) : null}
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
              schema={schema}
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
            unwindowedFilter={unwindowedFilter}
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
