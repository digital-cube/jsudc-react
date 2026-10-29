// @jsudc/react/map: the map renderer. Needs the `leaflet` peer.
import { MapPinned } from "lucide-react";
import type { RendererDefinition } from "../renderers/types";
import { MapRenderer } from "./MapRenderer";

export { MapRenderer } from "./MapRenderer";

/** `createRendererRegistry(mapRenderer, …)`: the `map` tab. */
export const mapRenderer: RendererDefinition = {
  name: "map",
  component: MapRenderer,
  icon: MapPinned,
  labelKey: "TAB_MAP",
  paging: false,
  editMode: false,
};
