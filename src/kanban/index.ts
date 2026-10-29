// @jsudc/react/kanban: the kanban board. Needs the `@dnd-kit/core`, `@dnd-kit/sortable` and
// `@dnd-kit/utilities` peers.
import { Kanban } from "lucide-react";
import type { RendererDefinition } from "../renderers/types";
import { KanbanBoardSwitcher } from "./KanbanBoardSwitcher";
import { KanbanRenderer } from "./KanbanRenderer";

export { KanbanBoardSwitcher } from "./KanbanBoardSwitcher";
export { KanbanRenderer } from "./KanbanRenderer";

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
