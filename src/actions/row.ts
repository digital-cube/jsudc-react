// Row actions (0.5.0): the actions one row of a data view offers — `view.row_action_defs`, or
// the kinds of `view.row_actions` — each where its `when` holds, shown inline or in a menu, and
// run through the same plan as a bulk action (`planBulkAction`). No JSX (`@jsudc/react/headless`
// exports it).
import { type ActionDef, isActionEligible, type Row, type ViewConfig } from "@jsudc/core";

/**
 * How a view draws its row actions: icon buttons in a trailing column
 * (`inline`), one "more" menu in a trailing column (`menu`), or a bar of icon
 * buttons over the row's trailing cells while the row is hovered or focused,
 * with no column of its own (`hover`, 0.8.1).
 */
export type RowActionsDisplay = "inline" | "menu" | "hover";

/** How many buttons the `hover` bar shows when the view sets no `row_actions_max`. */
export const DEFAULT_ROW_ACTIONS_MAX = 4;

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

/**
 * `view.row_actions_display`; absent (or a value this version does not know):
 * `inline`, as in udc-js. Read loosely, so a view typed by an older
 * `@jsudc/core` (whose enum has no `hover`) passes too.
 */
export function rowActionsDisplay(view: { row_actions_display?: unknown }): RowActionsDisplay {
  const display = view.row_actions_display;
  return display === "menu" || display === "hover" ? display : "inline";
}

/**
 * `view.row_actions_max`: the most buttons the `hover` bar shows. Absent, or
 * not a positive integer: `DEFAULT_ROW_ACTIONS_MAX` (4). Read loosely, like
 * `rowActionsDisplay`.
 */
export function rowActionsMax(view: object): number {
  const max = (view as { row_actions_max?: unknown }).row_actions_max;
  return typeof max === "number" && Number.isInteger(max) && max > 0
    ? max
    : DEFAULT_ROW_ACTIONS_MAX;
}

/** Where a row action goes in the `hover` display: `def.placement`, `bar` when absent. */
export function rowActionPlacement(def: ActionDef): "bar" | "menu" {
  return (def as { placement?: unknown }).placement === "menu" ? "menu" : "bar";
}

/** One row's eligible actions as the `hover` display draws them. */
export interface RowActionSplit {
  /** The icon buttons of the bar, in declared order. */
  bar: ActionDef[];
  /** The rest, in declared order: the dropdown of the ⋮ button at the bar's end. */
  overflow: ActionDef[];
}

/**
 * Split one row's eligible actions (`eligibleRowActions`) for the `hover`
 * bar: `bar` takes, in declared order, each one that has an icon (`hasIcon`)
 * and is not `placement: menu`, up to `max` (default 4); every other one goes
 * to `overflow`, in declared order. Pure: `hasIcon` is the renderer's answer
 * (the styled renderer's is a known `icon`, or the kind `delete`).
 */
export function splitRowActions(
  eligible: readonly ActionDef[],
  opts: { hasIcon: (def: ActionDef) => boolean; max?: number | undefined },
): RowActionSplit {
  const max = opts.max ?? DEFAULT_ROW_ACTIONS_MAX;
  const bar: ActionDef[] = [];
  const overflow: ActionDef[] = [];
  for (const def of eligible) {
    if (bar.length < max && rowActionPlacement(def) === "bar" && opts.hasIcon(def)) bar.push(def);
    else overflow.push(def);
  }
  return { bar, overflow };
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
 * `display` says, or in a menu; for `hover`, `split(row)`), label each with
 * `label`, run one with `run`.
 */
export interface RowActions {
  display: RowActionsDisplay;
  /** Every action the view declares for a row, before `when` (what sizes a column). */
  defs: readonly ActionDef[];
  /** The actions `row` offers now: `defs` whose `when` holds for it. */
  eligible: (row: Row) => ActionDef[];
  /**
   * `eligible(row)` split for the `hover` bar (`splitRowActions` with the
   * view's `row_actions_max`): the bar's icon buttons and the ⋮ dropdown's rest.
   */
  split: (row: Row) => RowActionSplit;
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
