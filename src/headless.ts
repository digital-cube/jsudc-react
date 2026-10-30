// @jsudc/react/headless: the hooks and models with no markup, for a host that draws its own
// renderer (Material, Ant, plain HTML) on the same data, filters and URL state. No JSX, no
// CSS and no renderer peer is reachable from here (test/entries.test.ts walks the imports):
// it needs only `react`, `@tanstack/react-query` and `@jsudc/core`.

// Each renderer's model and state hook.
export * from "./calendar/model.js";
export * from "./calendar/useCalendarUrl.js";
export * from "./cards/cardModel.js";
export * from "./chart/model.js";
export * from "./chart/useChartWindow.js";
export * from "./chart/window.js";
// The data view's state: tab, search, chips, filter tree, sort, paging, in the URL.
export * from "./data-view/compose.js";
export * from "./data-view/folder.js";
export * from "./data-view/liveView.js";
export * from "./data-view/urlState.js";
export * from "./data-view/useDataViewState.js";
export * from "./kanban/model.js";
export * from "./kanban/persist.js";
export * from "./kanban/useKanbanBoard.js";
export * from "./map/model.js";
// Which renderer draws a tab (the registry holds components, but this module imports none).
export * from "./renderers/context.js";
export * from "./renderers/registry.js";
export type * from "./renderers/types.js";
export { isFolderRow } from "./renderers/types.js";
export * from "./table/format.js";
export * from "./table/style.js";
export * from "./table/transforms.js";
// Time zones: the display zone preference and the zoned formatting.
export * from "./time/timezone.js";
export * from "./time/zoned.js";
export * from "./tree/expand.js";
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
} from "./tree/model.js";
// The client context and the hooks over @jsudc/core's client.
export * from "./udc/client.js";
export * from "./udc/hooks.js";
export * from "./udc/keys.js";
export * from "./url-state/adapter.js";
export * from "./url-state/UrlState.js";
