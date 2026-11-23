// @jsudc/react: the public surface. The data view, the providers and the renderer registry;
// the stylesheet is `@jsudc/react/styles.css` (its variables alone: `@jsudc/react/tokens.css`).
// The renderers are subpaths (`@jsudc/react/table`, `/cards`, `/kanban`, `/calendar`, `/tree`,
// `/map`, `/chart`; all of them: `@jsudc/react/all`), so this entry imports none of them and
// none of their peers. Hooks and models without markup: `@jsudc/react/headless`. The UI
// primitives (Radix + Tailwind) and the default kit: `@jsudc/react/ui`.

export {
  type BulkActionContext,
  type BulkActionHandler,
  type BulkActionHandlers,
  type BulkActionPlan,
  bulkActionEligible,
  MATCH_ALL,
  planBulkAction,
  selectionTarget,
  UdcActionsProvider,
  type UdcActionsProviderProps,
  useBulkActionHandlers,
} from "./actions/bulk.js";
export {
  RowActionsControls,
  type RowActionsControlsProps,
  type RowMenuState,
  type RowMenuVia,
  rowActionsColumnWidth,
  rowMenuHandlers,
  useRowMenu,
} from "./actions/RowActionsMenu.js";
// Row actions (0.5.0): what a row offers and how it runs (also in `@jsudc/react/headless`),
// and the buttons and menu the table and the cards draw them with.
export {
  eligibleRowActions,
  isRowMenuKey,
  type RowActions,
  type RowActionsDisplay,
  type RowMenuKeyEvent,
  rowActionDefs,
  rowActionsDisplay,
} from "./actions/row.js";
// Custom cells: components a column's `render` names, registered like the renderers.
export {
  type CellComponent,
  type CellDefinition,
  type CellProps,
  type CellRegistry,
  cellComponent,
  createCellRegistry,
  mergeCellRegistries,
  UdcCellsProvider,
  type UdcCellsProviderProps,
  useCellRegistry,
} from "./cells/registry.js";
export { LiveIndicator } from "./data-view/LiveIndicator.js";
// Which headers offer a sort (0.5.2): `describe.sortable` and a column's `sortable: false`.
export { columnSortable, sourceSortable } from "./data-view/liveView.js";
// One collection: the tabs its view declares, each drawn by a registered renderer.
export {
  resolveChrome,
  UdcDataView,
  type UdcDataViewChrome,
  type UdcDataViewChromePreset,
  type UdcDataViewProps,
} from "./data-view/UdcDataView.js";
// Strings: the provider, the library dictionary and the helpers over it.
export {
  INTL_LOCALE,
  intlLocaleOf,
  isLocale,
  LOCALE_STORAGE_KEY,
  lookup,
  type Messages,
  makeT,
  mergeMessages,
  messageLocales,
  type Overlay,
  schemaLabelTerms,
  tableSection,
  UdcI18nProvider,
  type UdcI18nProviderProps,
  useI18n,
  type Vars,
} from "./i18n/i18n.js";
export {
  type BuiltinLocale,
  LOCALES,
  type Locale,
  type Term,
  TRANSLATIONS,
  type Translations,
} from "./i18n/translations.js";
// Icons, theme, helpers, renderer registry and types, the time zone.
export { LUCIDE_ICONS } from "./icons/lucide.generated.js";
export { FALLBACK_ICON, resolveIcon } from "./icons/resolve.js";
export { UDC_SCOPE_CLASS } from "./lib/scope.js";
export { THEME_STORAGE_KEY, type Theme, ThemeProvider, useTheme } from "./lib/theme.js";
export { cn, humanize, storage } from "./lib/utils.js";
export {
  type BatchEntry,
  batchCovers,
  type LookupBatch,
  UdcLookupBatch,
  useLookupBatch,
  useLookupBatchContext,
} from "./lookup/batch.js";
export { LookupCombobox } from "./lookup/LookupCombobox.js";
export { LookupSelectChip } from "./lookup/LookupSelectChip.js";
export { LookupValue, useLookupLabels, useLookupRows } from "./lookup/LookupValue.js";
export { lookupExtras, lookupLabel } from "./lookup/label.js";
export {
  defaultUdcLinks,
  filterHref,
  followLink,
  type UdcLinks,
  UdcLinksProvider,
  useUdcLinks,
} from "./lookup/links.js";
export {
  LOOKUP_OPTIONS_LIMIT,
  type LookupOption,
  type LookupOptionsResult,
  optionsFilter,
  useLookupOptions,
} from "./lookup/options.js";
export {
  asLookup,
  fetchLookupRows,
  keyString,
  type LookupRequest,
  type LookupRows,
  lookupKeys,
  lookupQuery,
  type UdcLookupResult,
  useUdcLookup,
  useUdcLookups,
  valueKeys,
} from "./lookup/useUdcLookup.js";
export {
  UdcRenderersProvider,
  type UdcRenderersProviderProps,
  useRendererRegistry,
} from "./renderers/context.js";
export {
  createRendererRegistry,
  type RendererTab,
  rendererEntry,
  rendererTabs,
  resolveTab,
} from "./renderers/registry.js";
export {
  type FolderNav,
  isFolderRow,
  type RendererCount,
  type RendererDefinition,
  type RendererEntry,
  type RendererProps,
  type RendererRegistry,
} from "./renderers/types.js";
// Row activation and keyboard movement, for a host renderer (also in `@jsudc/react/headless`).
export {
  ownsKeys,
  type RowActivation,
  type RowActivationProps,
  type RowActivationRowProps,
  rowActivationEnabled,
  type UseRowActivationOptions,
  useRowActivation,
} from "./rows/useRowActivation.js";
// Row selection and bulk actions (0.5.0; also in `@jsudc/react/headless`).
export {
  EMPTY_SELECTION,
  pageSelectionState,
  type RowSelection,
  type RowSelectionState,
  selectAllMatching,
  selectionCount,
  selectionHas,
  selectionIsEmpty,
  selectRange,
  setPageSelection,
  toggleSelection,
  type UseRowSelectionOptions,
  useRowSelection,
} from "./rows/useRowSelection.js";
export { EmptyState, ErrorState, NoRendererState } from "./table/states.js";
// Long lists (0.5.0): the table's row window, its options (also in `@jsudc/react/headless`).
export {
  DEFAULT_VIRTUAL_OVERSCAN,
  DEFAULT_VIRTUAL_THRESHOLD,
  resolveVirtualization,
  type TableVirtualization,
  type TableVirtualizeProp,
  virtualizationApplies,
} from "./table/useRowWindow.js";
export {
  BROWSER_TZ,
  COMMON_ZONES,
  TimezoneProvider,
  type TimezoneState,
  TZ_STORAGE_KEY,
  useTimezone,
} from "./time/timezone.js";
export {
  allZones,
  browserZone,
  isValidZone,
  offsetLabel,
  offsetMinutes,
  zoneCity,
} from "./time/zoned.js";
export { i18nKey } from "./tree/model.js";
export {
  UdcChangeFeed,
  type UdcChangeFeedOptions,
  type UdcChangeFeedStatus,
} from "./udc/changeFeed.js";
export {
  UdcChangeFeedContext,
  type UdcChangesResult,
  type UseUdcChangesOptions,
  useUdcChangeFeed,
  useUdcChanges,
} from "./udc/changes.js";
// The hooks over @jsudc/core's client, the client context and the TanStack Query client.
export {
  ALL_ROWS_MAX,
  applyToListRows,
  callAction,
  type FetchAllRowsArgs,
  fetchAllRows,
  freshnessOf,
  mutateManyTouches,
  pageOffset,
  patchRowInList,
  pollInterval,
  type UdcAllRowsResult,
  type UdcCollectionResult,
  type UdcMutateManyVars,
  type UdcMutateVars,
  type UseUdcActionOptions,
  type UseUdcAllRowsArgs,
  type UseUdcCollectionArgs,
  useUdcAction,
  useUdcAllRows,
  useUdcCollection,
  useUdcCollections,
  useUdcDescribe,
  useUdcMutate,
  useUdcMutateMany,
  useUdcSchema,
  useUdcSource,
} from "./udc/hooks.js";
export { type ListKeyParams, type PagingMode, udcKeys } from "./udc/keys.js";
export {
  createUdcQueryClient,
  shouldRetry,
  UdcProvider,
  type UdcProviderChangesOptions,
  type UdcQueryClientOptions,
  useUdcClient,
} from "./udc/provider.js";
// The UI kit: the primitives every renderer draws with, from context. The default kit and the
// primitives themselves are `@jsudc/react/ui`; a host brings its own through the provider.
export {
  type ButtonSize,
  type ButtonVariant,
  type PreventableEvent,
  type SegmentedOption,
  type SelectOption,
  type ToastInput,
  type ToastVariant,
  UdcUiProvider,
  type UdcUiProviderProps,
  type UiBlockProps,
  type UiButtonProps,
  type UiCheckboxProps,
  type UiDialogContentProps,
  type UiDialogProps,
  type UiDropdownMenuContentProps,
  type UiDropdownMenuItemProps,
  type UiDropdownMenuProps,
  type UiInputProps,
  type UiKbdProps,
  type UiKit,
  type UiNativeSelectProps,
  type UiPopoverAnchorProps,
  type UiPopoverContentProps,
  type UiPopoverProps,
  type UiSegmentedProps,
  type UiSelectProps,
  type UiSkeletonProps,
  type UiSpinnerProps,
  type UiTipProps,
  type UiTriggerProps,
  useUiKit,
} from "./ui-kit/index.js";
// URL state: where the data view keeps filters, sort and page. `window.location` by default;
// a router's adapter through the provider (the package ships one on a subpath, see README).
export {
  createMemoryUrlStateAdapter,
  type MemoryUrlStateAdapter,
  prefixUrlStateAdapter,
  type SetUrlSearchParams,
  UdcUrlStateProvider,
  type UdcUrlStateProviderProps,
  type UrlStateAdapter,
  useUrlSearchParams,
  useUrlStateAdapter,
  windowLocationAdapter,
} from "./url-state/index.js";
