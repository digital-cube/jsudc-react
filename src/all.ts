// @jsudc/react/all: every renderer, and `RENDERERS`, the registry of all of them (what the
// package root exported before the renderers became subpaths). Needs every optional peer:
// `@tanstack/react-table`, `@dnd-kit/*`, `leaflet`, `recharts`.
import { calendarRenderer } from "./calendar";
import { cardsRenderer } from "./cards";
import { chartRenderer } from "./chart";
import { kanbanRenderer } from "./kanban";
import { mapRenderer } from "./map";
import { createRendererRegistry } from "./renderers/registry";
import { tableRenderer } from "./table";
import { treeRenderer } from "./tree";

export { calendarRenderer } from "./calendar";
export { cardsRenderer } from "./cards";
export { chartRenderer } from "./chart";
export { kanbanRenderer } from "./kanban";
export { mapRenderer } from "./map";
export { tableRenderer } from "./table";
export { treeRenderer } from "./tree";

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
