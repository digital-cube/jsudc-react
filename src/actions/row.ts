// Row actions (0.5.0): the actions one row of a data view offers — `view.row_action_defs`, or
// the kinds of `view.row_actions` — each where its `when` holds, shown inline or in a menu, and
// run through the same plan as a bulk action (`planBulkAction`). No JSX (`@jsudc/react/headless`
// exports it).
import { type ActionDef, isActionEligible, type Row, type ViewConfig } from "@jsudc/core";

/** How a view draws its row actions: icon buttons in a trailing column, or one "more" menu. */
export type RowActionsDisplay = "inline" | "menu";

/**
 * The actions a view declares for one row, read as udc-js reads them: the
 * typed `row_action_defs` when the view has any, else the kinds of the
 * legacy `row_actions` lifted to `{ kind }`. Empty: the view has no row
 * actions and draws nothing new.
 */
export function rowActionDefs(
  view: Pick<ViewConfig, "row_actions" | "row_action_defs">,
): ActionDef[] {
  const typed = view.row_action_defs ?? [];
  if (typed.length > 0) return [...typed];
  return (view.row_actions ?? []).map((kind) => ({ kind }));
}

/** `view.row_actions_display`; absent: `inline`, as in udc-js. */
export function rowActionsDisplay(
  view: Pick<ViewConfig, "row_actions_display">,
): RowActionsDisplay {
  return view.row_actions_display === "menu" ? "menu" : "inline";
}

/** The actions `row` offers: those of `defs` whose `when` holds for it (`isActionEligible`). */
export function eligibleRowActions(defs: readonly ActionDef[], row: Row): ActionDef[] {
  return defs.filter((def) => isActionEligible(def, row));
}

/** The keyboard modifiers and key a row menu key is read from. */
export interface RowMenuKeyEvent {
  key: string;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

/**
 * Does this key open the menu of the focused row? The context-menu key,
 * Shift+F10, or `.` (no modifier; unbound by the row keys of 0.4.0).
 */
export function isRowMenuKey(e: RowMenuKeyEvent): boolean {
  if (e.altKey || e.ctrlKey || e.metaKey) return false;
  if (e.key === "ContextMenu") return true;
  if (e.key === "F10") return e.shiftKey;
  return e.key === "." && !e.shiftKey;
}

/**
 * What `RendererProps.rowActions` hands a renderer: set when the view
 * declares row actions, absent otherwise. Draw `eligible(row)` (inline as
 * `display` says, or in a menu), label each with `label`, run one with `run`.
 */
export interface RowActions {
  display: RowActionsDisplay;
  /** Every action the view declares for a row, before `when` (what sizes a column). */
  defs: readonly ActionDef[];
  /** The actions `row` offers now: `defs` whose `when` holds for it. */
  eligible: (row: Row) => ActionDef[];
  /** The words for an action in the UI language: the collection's term, then the def's `label`. */
  label: (def: ActionDef) => string;
  /**
   * Run `def` on `row`, as a bulk action runs on a selection of that one
   * row: the host's handler for its `kind`, else `delete` (after a
   * confirmation), a `set` patch (optimistic), or the server action the def
   * names. Errors are shown as a toast; the promise does not reject.
   */
  run: (def: ActionDef, row: Row) => Promise<void>;
  /** The `kind` running on the row with this id now, else `null`. */
  runningOn: (rowId: string) => string | null;
}
