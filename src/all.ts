// @jsudc/react/all: every renderer, and `RENDERERS`, the registry of all of them (what the
// package root exported before the renderers became subpaths). Needs every optional peer:
// `@tanstack/react-table`, `@dnd-kit/*`, `leaflet`, `recharts`.
import { calendarRenderer } from "./calendar/index.js";
import { cardsRenderer } from "./cards/index.js";
import { chartRenderer } from "./chart/index.js";
import { kanbanRenderer } from "./kanban/index.js";
import { mapRenderer } from "./map/index.js";
import { createRendererRegistry } from "./renderers/registry.js";
import { tableRenderer } from "./table/index.js";
import { treeRenderer } from "./tree/index.js";

export { calendarRenderer } from "./calendar/index.js";
export { cardsRenderer } from "./cards/index.js";
export { chartRenderer } from "./chart/index.js";
export { kanbanRenderer } from "./kanban/index.js";
export { mapRenderer } from "./map/index.js";
export { tableRenderer } from "./table/index.js";
export { treeRenderer } from "./tree/index.js";

/** Every renderer the package ships: `<UdcProvider renderers={RENDERERS}>`. */
export const RENDERERS = createRendererRegistry(
  tableRenderer,
  cardsRenderer,
  kanbanRenderer,
  calendarRenderer,
  treeRenderer,
  mapRenderer,
  chartRenderer,
);
