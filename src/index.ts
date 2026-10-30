// @jsudc/react: the public surface. The data view, the providers and the renderer registry;
// the stylesheet is `@jsudc/react/styles.css` (its variables alone: `@jsudc/react/tokens.css`).
// The renderers are subpaths (`@jsudc/react/table`, `/cards`, `/kanban`, `/calendar`, `/tree`,
// `/map`, `/chart`; all of them: `@jsudc/react/all`), so this entry imports none of them and
// none of their peers. Hooks and models without markup: `@jsudc/react/headless`. The UI
// primitives (Radix + Tailwind) and the default kit: `@jsudc/react/ui`.

// One collection: the tabs its view declares, each drawn by a registered renderer.
export { UdcDataView, type UdcDataViewProps } from "./data-view/UdcDataView.js";
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
export { THEME_STORAGE_KEY, type Theme, ThemeProvider, useTheme } from "./lib/theme.js";
export { cn, humanize, storage } from "./lib/utils.js";
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
export { EmptyState, ErrorState, NoRendererState } from "./table/states.js";
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
// The hooks over @jsudc/core's client, the client context and the TanStack Query client.
export {
  ALL_ROWS_MAX,
  type FetchAllRowsArgs,
  fetchAllRows,
  freshnessOf,
  pageOffset,
  patchRowInList,
  pollInterval,
  type UdcAllRowsResult,
  type UdcCollectionResult,
  type UdcMutateVars,
  type UseUdcAllRowsArgs,
  type UseUdcCollectionArgs,
  useUdcAllRows,
  useUdcCollection,
  useUdcCollections,
  useUdcDescribe,
  useUdcMutate,
  useUdcSchema,
  useUdcSource,
} from "./udc/hooks.js";
export { type ListKeyParams, type PagingMode, udcKeys } from "./udc/keys.js";
export { createUdcQueryClient, shouldRetry, UdcProvider, useUdcClient } from "./udc/provider.js";
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
  type SetUrlSearchParams,
  UdcUrlStateProvider,
  type UdcUrlStateProviderProps,
  type UrlStateAdapter,
  useUrlSearchParams,
  useUrlStateAdapter,
  windowLocationAdapter,
} from "./url-state/index.js";
