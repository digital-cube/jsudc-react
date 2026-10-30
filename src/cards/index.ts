// @jsudc/react/cards: the card grid renderer. No peer beyond the main entry's.
import { LayoutGrid } from "lucide-react";
import type { RendererDefinition } from "../renderers/types.js";
import { CardRenderer } from "./CardRenderer.js";

export { CardRenderer, type CardRendererProps } from "./CardRenderer.js";

/** `createRendererRegistry(cardsRenderer, …)`: the `cards` tab, paged. */
export const cardsRenderer: RendererDefinition = {
  name: "cards",
  component: CardRenderer,
  icon: LayoutGrid,
  labelKey: "TAB_CARDS",
  paging: true,
  editMode: false,
};
