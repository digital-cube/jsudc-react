// @jsudc/react/headless: the hooks and models with no markup, for a host that draws its own
// renderer (Material, Ant, plain HTML) on the same data, filters and URL state. No JSX, no
// CSS and no renderer peer is reachable from here (test/entries.test.ts walks the imports):
// it needs only `react`, `@tanstack/react-query` and `@jsudc/core`.

// Each renderer's model and state hook.
export * from "./calendar/model";
export * from "./calendar/useCalendarUrl";
export * from "./cards/cardModel";
export * from "./chart/model";
export * from "./chart/useChartWindow";
export * from "./chart/window";
// The data view's state: tab, search, chips, filter tree, sort, paging, in the URL.
export * from "./data-view/compose";
export * from "./data-view/folder";
export * from "./data-view/liveView";
export * from "./data-view/urlState";
export * from "./data-view/useDataViewState";
export * from "./kanban/model";
export * from "./kanban/persist";
export * from "./kanban/useKanbanBoard";
export * from "./map/model";
// Which renderer draws a tab (the registry holds components, but this module imports none).
export * from "./renderers/context";
export * from "./renderers/registry";
export type * from "./renderers/types";
export { isFolderRow } from "./renderers/types";
export * from "./table/format";
export * from "./table/style";
export * from "./table/transforms";
// Time zones: the display zone preference and the zoned formatting.
export * from "./time/timezone";
export * from "./time/zoned";
export * from "./tree/expand";
// The tree's drop plan shares its names with the kanban's: prefixed here.
export {
  type BuiltTree,
  buildTree,
  canDrop,
  type DropPlan as TreeDropPlan,
  type DropTarget,
  dropId,
  dropParent,
  findMatchRanges,
  highlightParts,
  i18nKey,
  idOf,
  lazyChildrenQuery,
  lazyRootsQuery,
  numberOf,
  parentLookup,
  parentOf,
  parseDropId,
  planDrop as planTreeDrop,
  REPLY_AUTHOR,
  reparentRequest,
  replyRow,
  rootCondition,
  searchExpansion,
  siblingsQuery,
  sortSiblings,
} from "./tree/model";
// The client context and the hooks over @jsudc/core's client.
export * from "./udc/client";
export * from "./udc/hooks";
export * from "./udc/keys";
export * from "./url-state/adapter";
export * from "./url-state/UrlState";
