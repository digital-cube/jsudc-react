// @jsudc/react/map: the map renderer. Needs the `leaflet` peer.
import { MapPinned } from "lucide-react";
import type { RendererDefinition } from "../renderers/types.js";
import { MapRenderer } from "./MapRenderer.js";

export { MapRenderer } from "./MapRenderer.js";

/** `createRendererRegistry(mapRenderer, …)`: the `map` tab. */
export const mapRenderer: RendererDefinition = {
  name: "map",
  component: MapRenderer,
  icon: MapPinned,
  labelKey: "TAB_MAP",
  paging: false,
  editMode: false,
};
