// @jsudc/react/chart: the chart renderer. Needs the `recharts` peer.
import { ChartLine } from "lucide-react";
import type { RendererDefinition } from "../renderers/types";
import { ChartRenderer } from "./ChartRenderer";

export { ChartRenderer } from "./ChartRenderer";

/**
 * `createRendererRegistry(chartRenderer, …)`: the `chart` tab. The window control is drawn by
 * the data view: once picked it also filters the other tabs.
 */
export const chartRenderer: RendererDefinition = {
  name: "chart",
  component: ChartRenderer,
  icon: ChartLine,
  labelKey: "TAB_CHART",
  paging: false,
  editMode: false,
};
