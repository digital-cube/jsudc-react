// The published declarations as a host sees them: every subpath through the package's own
// `exports` (a self-reference to dist/, so run it after `npm run build`), compiled once under
// moduleResolution NodeNext and once under Bundler (smoke/tsconfig.*.json). An import the
// declarations cannot resolve turns its types into `any`; the @ts-expect-error lines fail then.
import type { DescribeResponse, FilterNode, Row, SortKey } from "@jsudc/core";
import {
  type CellProps,
  type CellRegistry,
  createCellRegistry,
  createMemoryUrlStateAdapter,
  createRendererRegistry,
  type FolderNav,
  type PagingMode,
  prefixUrlStateAdapter,
  type RendererCount,
  type RendererDefinition,
  type RendererProps,
  type RowActions,
  RowActionsControls,
  type RowActivationProps,
  type RowSelection,
  type UdcCollectionResult,
  UdcDataView,
  type UdcDataViewProps,
  UdcProvider,
  useRowMenu,
  windowLocationAdapter,
} from "@jsudc/react";
import { RENDERERS } from "@jsudc/react/all";
import { cardsRenderer } from "@jsudc/react/cards";
import {
  type BulkActionHandlers,
  eligibleRowActions,
  createCellRegistry as headlessCells,
  createMemoryUrlStateAdapter as headlessMemory,
  prefixUrlStateAdapter as headlessPrefix,
  isRowMenuKey,
  rowActionDefs,
  type useDataViewState,
  useRowActivation,
  useRowSelection,
  useUdcAction,
  useUdcMutateMany,
} from "@jsudc/react/headless";
import { UdcReactRouterUrlState } from "@jsudc/react/react-router";
import { tableRenderer } from "@jsudc/react/table";
import { defaultUiKit, Toaster } from "@jsudc/react/ui";
import { Inbox } from "lucide-react";
import { type ComponentType, createElement } from "react";

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
    onRowActivate?: ((row: Row) => void) | undefined;
    activeRowId?: string | null | undefined;
    onActiveRowChange?: ((row: Row | null) => void) | undefined;
    selection?: RowSelection | undefined;
    rowActions?: RowActions | undefined;
  }
> = true;

// RendererProps exactly as 0.3.1 published it: a host renderer written against it still is a
// renderer of 0.4.0 (every prop added since is optional).
interface RendererProps031 {
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
function OldList({ data }: RendererProps031) {
  return createElement("ol", null, String(data.rows.length));
}
export const oldRenderer: RendererDefinition = {
  name: "old",
  component: OldList,
  icon: Inbox,
  labelKey: "TAB_OLD",
  paging: true,
  editMode: false,
};
// …and the props a 0.4.0 view hands it still satisfy 0.3.1's shape.
export const narrowed: ComponentType<RendererProps> = OldList;
export const widened = (p: RendererProps): RendererProps031 => p;

// Row activation (README "Row activation and keyboard"): on the view, and through the headless
// hook in a host renderer.
function ActiveList({ data, onRowActivate, activeRowId, onActiveRowChange }: RendererProps) {
  const nav = useRowActivation({ rows: data.rows, onRowActivate, activeRowId, onActiveRowChange });
  const items = data.rows.map((row) =>
    createElement(
      "li",
      { key: row.__meta.id, ...nav.rowProps(row), onClick: (e) => nav.handleClick(e, row) },
      String(row.subject),
    ),
  );
  return createElement("ul", { role: nav.enabled ? "grid" : undefined }, items);
}
export const activation: RowActivationProps = {
  onRowActivate: (row: Row) => row.__meta.id,
  activeRowId: null,
  onActiveRowChange: (row: Row | null) => row?.__meta.id,
};
export const activeView: UdcDataViewProps = { collection: "messages", ...activation };
// @ts-expect-error activeRowId is a row id, not a row
export const badActive: UdcDataViewProps = { collection: "x", activeRowId: { id: "m1" } };

// Custom cells (README "Custom cells"): registered on the provider or per view.
function Sender({ value, row, column, def, collection, surface }: CellProps) {
  const size = column.render_options?.size;
  return createElement(
    "span",
    { title: `${collection}/${row.__meta.id}/${def?.type}/${surface}/${String(size)}` },
    String(value),
  );
}
export const cells: CellRegistry = createCellRegistry({ name: "sender", component: Sender });
export const cellsHeadless: CellRegistry = headlessCells({ name: "sender", component: Sender });
export const withCells: UdcDataViewProps = { collection: "messages", cells };
// @ts-expect-error a cell definition needs a component
createCellRegistry({ name: "sender" });

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

// RendererProps exactly as 0.4.0 published it: a host renderer written against it still is a
// renderer of 0.5.0 (`selection` is optional).
type RendererProps040 = Omit<RendererProps, "selection">;
function List040({ data, onRowActivate }: RendererProps040) {
  return createElement("ol", { onClick: () => onRowActivate?.(data.rows[0] as Row) });
}
export const renderer040: RendererDefinition = {
  name: "r040",
  component: List040,
  icon: Inbox,
  labelKey: "TAB_R040",
  paging: true,
  editMode: false,
};

// Selection and bulk actions (README "Selection and bulk actions").
function SelectList({ data, selection }: RendererProps) {
  const items = data.rows.map((row) =>
    createElement("input", {
      key: row.__meta.id,
      type: "checkbox",
      checked: selection?.isSelected(row.__meta.id) ?? false,
      onChange: () => selection?.toggle(row.__meta.id, { range: false }),
    }),
  );
  return createElement("div", { "data-count": selection?.count ?? "all" }, items);
}
export const bulkHandlers: BulkActionHandlers = {
  archive: ({ ids, filter, exceptIds, rows, collection, clearSelection }) => {
    clearSelection();
    return [ids, filter, exceptIds, rows.length, collection];
  },
};
export const selectable: UdcDataViewProps = {
  collection: "messages",
  selectable: true,
  actions: bulkHandlers,
};
// @ts-expect-error a handler is a function of the action's context
export const badHandlers: BulkActionHandlers = { archive: "archive" };
export const selectionHooks = [useRowSelection, useUdcMutateMany, useUdcAction, SelectList];

// Row actions (README "Row actions").
function ActionList({ data, rowActions }: RendererProps) {
  const menu = useRowMenu();
  const items = data.rows.map((row) =>
    rowActions
      ? createElement(RowActionsControls, { key: row.__meta.id, row, rowActions, menu })
      : null,
  );
  return createElement("div", { "data-display": rowActions?.display ?? "none" }, items);
}
export function runFirst(actions: RowActions, row: Row): Promise<void> | undefined {
  const [first] = actions.eligible(row);
  return first ? actions.run(first, row) : undefined;
}
export const rowDefs = rowActionDefs({ row_actions: ["delete"], row_action_defs: undefined });
export const rowEligible = (row: Row) => eligibleRowActions(rowDefs, row).map((d) => d.kind);
export const menuKey = isRowMenuKey({
  key: ".",
  shiftKey: false,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
});
export const rowHandlers: BulkActionHandlers = {
  archive: ({ row, ids }) => [row?.__meta.id, ids],
};
// @ts-expect-error `run` takes the def and the row
export const badRun = (actions: RowActions) => actions.run("archive");

export const used = [
  ActionList,
  ActiveList,
  RENDERERS,
  UdcDataView,
  UdcProvider,
  UdcReactRouterUrlState,
  defaultUiKit,
  Toaster,
];
