// @jsudc/react/calendar: the calendar renderer. No peer beyond the main entry's.
import type { DescribeResponse } from "@jsudc/core";
import { CalendarDays } from "lucide-react";
import { createElement } from "react";
import { KanbanBoardSwitcher } from "../kanban/KanbanBoardSwitcher.js";
import type { RendererDefinition } from "../renderers/types.js";
import { CalendarRenderer } from "./CalendarRenderer.js";

export { CalendarRenderer } from "./CalendarRenderer.js";

/** The calendar of a kanban collection keeps the board switcher: it shows the board's tickets. */
function CalendarToolbar(props: { collection: string; describe: DescribeResponse }) {
  return props.describe.view.kanban_options ? createElement(KanbanBoardSwitcher, props) : null;
}

/** `createRendererRegistry(calendarRenderer, …)`: the `calendar` tab. */
export const calendarRenderer: RendererDefinition = {
  name: "calendar",
  component: CalendarRenderer,
  icon: CalendarDays,
  labelKey: "TAB_CALENDAR",
  paging: false,
  editMode: false,
  toolbar: CalendarToolbar,
};
