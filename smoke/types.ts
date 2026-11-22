// The published declarations as a host sees them: every subpath through the package's own
// `exports` (a self-reference to dist/, so run it after `npm run build`), compiled once under
// moduleResolution NodeNext and once under Bundler (smoke/tsconfig.*.json). An import the
// declarations cannot resolve turns its types into `any`; the @ts-expect-error lines fail then.
import type { DescribeResponse, FilterNode, SortKey } from "@jsudc/core";
import {
  createMemoryUrlStateAdapter,
  createRendererRegistry,
  type FolderNav,
  type PagingMode,
  prefixUrlStateAdapter,
  type RendererCount,
  type RendererDefinition,
  type RendererProps,
  type UdcCollectionResult,
  UdcDataView,
  type UdcDataViewProps,
  UdcProvider,
  windowLocationAdapter,
} from "@jsudc/react";
import { RENDERERS } from "@jsudc/react/all";
import { cardsRenderer } from "@jsudc/react/cards";
import {
  createMemoryUrlStateAdapter as headlessMemory,
  prefixUrlStateAdapter as headlessPrefix,
  type useDataViewState,
} from "@jsudc/react/headless";
import { UdcReactRouterUrlState } from "@jsudc/react/react-router";
import { tableRenderer } from "@jsudc/react/table";
import { defaultUiKit, Toaster } from "@jsudc/react/ui";
import { Inbox } from "lucide-react";
import { createElement } from "react";

const registry = createRendererRegistry(tableRenderer, cardsRenderer);

// @ts-expect-error a number is not a renderer registry
export const notRegistry: typeof registry = 42;
// @ts-expect-error a number is not a renderer definition
createRendererRegistry(7);
// @ts-expect-error useDataViewState takes arguments of its own type, not a symbol
export const notArgs: Parameters<typeof useDataViewState> = [Symbol()];

// The RendererProps contract (README "Renderers"): a host-written renderer, compiled against the
// published declarations. Renaming, removing or retyping one of these props fails here.
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
export const rendererContract: Equal<
  RendererProps,
  {
    collection: string;
    describe: DescribeResponse;
    data: UdcCollectionResult;
    filter: FilterNode | undefined;
    baseFilter: FilterNode | undefined;
    chartWindow?: RendererProps["chartWindow"];
    unwindowedFilter?: FilterNode | undefined;
    search: string;
    sort: SortKey[];
    onSort: (field: string, multi: boolean) => void;
    mode: PagingMode;
    page: number;
    limit: number;
    onPage: (page: number) => void;
    filtered: boolean;
    onClearFilters: () => void;
    resetKey: string;
    onSchemaAction?: RendererProps["onSchemaAction"];
    onCount: (count: RendererCount | null) => void;
    folder?: FolderNav | undefined;
  }
> = true;

/** A message list drawn by the host: one line per row, subject and sender. */
function MessageList({ data, filtered, onClearFilters, mode, page, limit, onPage }: RendererProps) {
  if (data.isLoading) return createElement("p", null, "Loading…");
  if (data.rows.length === 0) {
    return filtered
      ? createElement("button", { type: "button", onClick: onClearFilters }, "Clear filters")
      : createElement("p", null, "No messages");
  }
  const lines = data.rows.map((row) =>
    createElement("li", { key: row.__meta.id }, `${String(row.subject)} · ${String(row.from)}`),
  );
  const more =
    mode === "infinite"
      ? data.hasNextPage
        ? createElement("button", { type: "button", onClick: data.fetchNextPage }, "More")
        : null
      : data.total !== null && page * limit < data.total
        ? createElement("button", { type: "button", onClick: () => onPage(page + 1) }, "Next")
        : null;
  return createElement("div", null, createElement("ul", null, lines), more);
}

export const messageList: RendererDefinition = {
  name: "messages",
  component: MessageList,
  icon: Inbox,
  labelKey: "TAB_MESSAGES",
  paging: true,
  editMode: false,
};
export const hostRegistry = createRendererRegistry(tableRenderer, messageList);

// Embedding: a host filter, no chrome, toolbar slots, state under a prefix or in memory.
export const embedded: UdcDataViewProps = {
  collection: "messages",
  renderers: hostRegistry,
  filter: { field: "folder", op: "eq", value: "inbox" },
  chrome: { preset: "embedded", tabs: true },
  pagingMode: "pages",
  toolbarStart: createElement("button", { type: "button" }, "Refresh"),
  toolbarEnd: null,
  urlPrefix: "inbox.",
  urlState: prefixUrlStateAdapter(windowLocationAdapter, "list."),
};
export const inMemory: UdcDataViewProps = { collection: "messages", urlState: "memory" };
export const fromHeadless = [headlessMemory(), headlessPrefix(createMemoryUrlStateAdapter(), "a.")];
// @ts-expect-error a chrome preset is "full" or "embedded"
export const badChrome: UdcDataViewProps = { collection: "x", chrome: "minimal" };

export const used = [
  RENDERERS,
  UdcDataView,
  UdcProvider,
  UdcReactRouterUrlState,
  defaultUiKit,
  Toaster,
];
