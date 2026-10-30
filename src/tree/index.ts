// @jsudc/react/tree: the tree renderer. Needs the `@dnd-kit/core` peer (drag to reparent).
import { ListTree } from "lucide-react";
import type { RendererDefinition } from "../renderers/types";
import { TreeRenderer } from "./TreeRenderer";

export { TreeRenderer } from "./TreeRenderer";

/** `createRendererRegistry(treeRenderer, …)`: the `tree` tab. */
export const treeRenderer: RendererDefinition = {
  name: "tree",
  component: TreeRenderer,
  icon: ListTree,
  labelKey: "TAB_TREE",
  paging: false,
  editMode: false,
};
