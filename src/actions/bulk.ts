// Bulk actions (0.5.0): what runs a `view.bulk_actions` entry on a selection — a host's
// handler by `kind`, else the server — and the provider that sets handlers for every data
// view below it. No JSX (`@jsudc/react/headless` exports it).
import {
  type ActionDef,
  actionServerName,
  type FilterNode,
  isActionEligibleForAll,
  type Row,
} from "@jsudc/core";
import { createContext, createElement, type ReactNode, useContext } from "react";
import type { RowSelection } from "../rows/useRowSelection.js";

/** The filter that matches every row: what "all that match" sends when the view has no filter. */
export const MATCH_ALL: FilterNode = Object.freeze({ and: [] }) as FilterNode;

/**
 * What a bulk action handler receives. In id mode `ids` names the selected
 * rows; in "all that match" mode `filter` is the list's filter (search,
 * chips, filter tree and the host's filter, composed; `{ and: [] }` for
 * none) and `exceptIds` the rows taken out of it. Exactly one of `ids` and
 * `filter` is set.
 */
export interface BulkActionContext {
  /** The action's `kind`, the key its handler is registered under. */
  kind: string;
  /** The `view.bulk_actions` entry. */
  def: ActionDef;
  collection: string;
  /** Id mode: the selected ids. */
  ids?: string[] | undefined;
  /** "All that match" mode: the filter the selection stands for. */
  filter?: FilterNode | undefined;
  /** "All that match" mode: the ids taken out of it. */
  exceptIds?: string[] | undefined;
  /** The selected rows the view has loaded (in "all that match" mode, not every selected row). */
  rows: Row[];
  /** Select nothing: call it once the action is done (the view does not clear on its own). */
  clearSelection: () => void;
  /**
   * A row action (0.5.0): the one row it was run on, also `ids[0]` and
   * `rows[0]`. Absent when the bulk bar ran it on a selection.
   */
  row?: Row | undefined;
}

/** Runs one bulk action. A rejected promise (or a throw) shows its message as an error. */
export type BulkActionHandler = (ctx: BulkActionContext) => unknown;

/** `kind` → handler: what `UdcDataView actions` and `UdcProvider actions` take. */
export type BulkActionHandlers = Readonly<Record<string, BulkActionHandler>>;

const NO_HANDLERS: BulkActionHandlers = Object.freeze({});
const ActionsContext = createContext<BulkActionHandlers>(NO_HANDLERS);

export interface UdcActionsProviderProps {
  /** The default handlers of every data view below; a view's own `actions` win by `kind`. Keep it stable. */
  actions: BulkActionHandlers;
  children: ReactNode;
}

/** Sets the bulk action handlers every `UdcDataView` below falls back to. */
export function UdcActionsProvider({ actions, children }: UdcActionsProviderProps) {
  return createElement(ActionsContext.Provider, { value: actions }, children);
}

/** The handlers in effect: the nearest provider's, else none. */
export function useBulkActionHandlers(): BulkActionHandlers {
  return useContext(ActionsContext);
}

/**
 * How a bulk action runs, in this order: `host` a handler for its `kind` (the
 * view's, else the provider's); `delete` the built-in delete (`mutate_many`
 * `delete`, after a confirmation); `set` a `mutate_many` `update` with the
 * def's `set`; `server` the server action named by the def's `action`
 * (default its `kind`), a host action registered on the dispatcher.
 */
export type BulkActionPlan =
  | { via: "host"; handler: BulkActionHandler }
  | { via: "delete" }
  | { via: "set"; patch: Record<string, unknown> }
  | { via: "server"; action: string };

export function planBulkAction(
  def: ActionDef,
  ...handlers: (BulkActionHandlers | undefined)[]
): BulkActionPlan {
  for (const h of handlers) {
    const handler = h && Object.hasOwn(h, def.kind) ? h[def.kind] : undefined;
    if (handler) return { via: "host", handler };
  }
  if (def.kind === "delete") return { via: "delete" };
  if (def.set) return { via: "set", patch: def.set };
  return { via: "server", action: actionServerName(def) };
}

/**
 * May the action run on the selection? Id mode: its `when` holds for every
 * selected row (`isActionEligibleForAll`). "All that match" mode: rows not
 * loaded cannot be checked in the browser, so it is offered unless `when` is
 * `false` and the server decides.
 */
export function bulkActionEligible(
  def: ActionDef,
  selection: Pick<RowSelection, "mode" | "rows">,
): boolean {
  if (selection.mode === "matching") return def.when !== false;
  return isActionEligibleForAll(def, selection.rows);
}

/** What a selection sends: `{ ids }`, or `{ filter, except_ids }` ("all that match"). */
export function selectionTarget(
  selection: Pick<RowSelection, "mode" | "ids" | "exceptIds">,
  filter: FilterNode | undefined,
): { ids: string[] } | { filter: FilterNode; except_ids?: string[] } {
  if (selection.mode === "ids") return { ids: [...selection.ids] };
  return {
    filter: filter ?? MATCH_ALL,
    ...(selection.exceptIds.length > 0 ? { except_ids: [...selection.exceptIds] } : {}),
  };
}
