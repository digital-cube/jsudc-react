// @jsudc/react/kanban: the kanban board. Needs the `@dnd-kit/core`, `@dnd-kit/sortable` and
// `@dnd-kit/utilities` peers.
import { Kanban } from "lucide-react";
import type { RendererDefinition } from "../renderers/types.js";
import { KanbanBoardSwitcher } from "./KanbanBoardSwitcher.js";
import { KanbanRenderer } from "./KanbanRenderer.js";

export { KanbanBoardSwitcher } from "./KanbanBoardSwitcher.js";
export { KanbanRenderer } from "./KanbanRenderer.js";

/** `createRendererRegistry(kanbanRenderer, …)`: the `kanban` tab, with the board switcher. */
export const kanbanRenderer: RendererDefinition = {
  name: "kanban",
  component: KanbanRenderer,
  icon: Kanban,
  labelKey: "TAB_KANBAN",
  paging: false,
  editMode: false,
  toolbar: KanbanBoardSwitcher,
};
