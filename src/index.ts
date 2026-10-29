// @jsudc/react: the public surface. Everything a host needs to render one
// collection is here; the stylesheet is `@jsudc/react/styles.css` (or
// `@jsudc/react/tokens.css` for a host that runs Tailwind itself). The UI
// primitives (Radix + Tailwind) and the default kit are `@jsudc/react/ui`.

// One collection: the tabs its view declares, each drawn by a renderer from RENDERERS.
export { UdcDataView } from "./data-view/UdcDataView";
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
} from "./i18n/i18n";
export {
  type BuiltinLocale,
  LOCALES,
  type Locale,
  type Term,
  TRANSLATIONS,
  type Translations,
} from "./i18n/translations";
// Icons, theme, helpers, renderer registry and types, the time zone.
export { LUCIDE_ICONS } from "./icons/lucide.generated";
export { FALLBACK_ICON, resolveIcon } from "./icons/resolve";
export { THEME_STORAGE_KEY, type Theme, ThemeProvider, useTheme } from "./lib/theme";
export { cn, humanize, storage } from "./lib/utils";
export {
  RENDERERS,
  type RendererTab,
  rendererEntry,
  rendererTabs,
  resolveTab,
} from "./renderers/registry";
export {
  type FolderNav,
  isFolderRow,
  type RendererCount,
  type RendererEntry,
  type RendererProps,
} from "./renderers/types";
export { EmptyState, ErrorState } from "./table/states";
export {
  BROWSER_TZ,
  COMMON_ZONES,
  TimezoneProvider,
  type TimezoneState,
  TZ_STORAGE_KEY,
  useTimezone,
} from "./time/timezone";
export {
  allZones,
  browserZone,
  isValidZone,
  offsetLabel,
  offsetMinutes,
  zoneCity,
} from "./time/zoned";
export { i18nKey } from "./tree/model";
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
} from "./udc/hooks";
export { type ListKeyParams, type PagingMode, udcKeys } from "./udc/keys";
export { createUdcQueryClient, shouldRetry, UdcProvider, useUdcClient } from "./udc/provider";
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
} from "./ui-kit";
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
} from "./url-state";
