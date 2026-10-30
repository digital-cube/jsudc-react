// @jsudc/react/table: the table renderer. Needs the `@tanstack/react-table` peer.
import { Table2 } from "lucide-react";
import type { RendererDefinition } from "../renderers/types";
import { TableRenderer } from "./TableRenderer";

export { CellValue, displayText, renderKind } from "./cells";
export { Pager } from "./Pager";
export { TableRenderer, type TableRendererProps } from "./TableRenderer";

/** `createRendererRegistry(tableRenderer, …)`: the `table` tab, paged, with the schema editor. */
export const tableRenderer: RendererDefinition = {
  name: "table",
  component: TableRenderer,
  icon: Table2,
  labelKey: "TAB_TABLE",
  paging: true,
  editMode: true,
};
