// @jsudc/react/table: the table renderer. Needs the `@tanstack/react-table` peer.
import { Table2 } from "lucide-react";
import type { RendererDefinition } from "../renderers/types.js";
import { TableRenderer } from "./TableRenderer.js";

export { CellValue, displayText, renderKind } from "./cells.js";
export { Pager } from "./Pager.js";
export { TableRenderer, type TableRendererProps } from "./TableRenderer.js";

/** `createRendererRegistry(tableRenderer, …)`: the `table` tab, paged, with the schema editor. */
export const tableRenderer: RendererDefinition = {
  name: "table",
  component: TableRenderer,
  icon: Table2,
  labelKey: "TAB_TABLE",
  paging: true,
  editMode: true,
};
