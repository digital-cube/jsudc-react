// The icon a row action is drawn with (0.5.0; its own module since 0.8.1, so the runner and the
// renderer answer "has an icon" alike): a known `icon`, else the bin for the kind `delete`.
import type { ActionDef } from "@jsudc/core";
import { Trash2 } from "lucide-react";
import { actionIcon } from "../data-view/BulkBar.js";

export function rowActionIcon(def: ActionDef) {
  return actionIcon(def.icon) ?? (def.kind === "delete" ? Trash2 : null);
}

/** Does `def` draw as an icon button? What `splitRowActions` is given as `hasIcon`. */
export function rowActionHasIcon(def: ActionDef): boolean {
  return rowActionIcon(def) !== null;
}
