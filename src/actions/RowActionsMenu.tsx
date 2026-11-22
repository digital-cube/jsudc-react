// The row actions of one row as the table and the cards draw them (0.5.0): icon buttons, or a
// "more" button opening a dropdown; the same dropdown opens from the keyboard and on right-click.
import type { ActionDef, Row } from "@jsudc/core";
import { EllipsisVertical, Trash2 } from "lucide-react";
import {
  type KeyboardEvent,
  type MouseEvent,
  type SyntheticEvent,
  useCallback,
  useRef,
  useState,
} from "react";
import { actionIcon } from "../data-view/BulkBar.js";
import { useI18n } from "../i18n/i18n.js";
import { cn } from "../lib/utils.js";
import { ownsKeys } from "../rows/useRowActivation.js";
import { useUiKit } from "../ui-kit/context.js";
import { isRowMenuKey, type RowActions } from "./row.js";

/** How a row's menu was opened: what decides where the focus goes when it closes. */
export type RowMenuVia = "trigger" | "key" | "context";

export interface RowMenuState {
  /** The row whose menu is open, else `null`. */
  openId: string | null;
  /** Open (or close, `null`) the menu of the row with this id. */
  openFor: (id: string | null, via?: RowMenuVia) => void;
  /** How the menu last opened (read when it closes). */
  lastVia: () => RowMenuVia;
}

/** Which row's actions menu is open: one per list. */
export function useRowMenu(): RowMenuState {
  const [openId, setOpenId] = useState<string | null>(null);
  const via = useRef<RowMenuVia>("trigger");
  const openFor = useCallback((id: string | null, how: RowMenuVia = "trigger") => {
    if (id !== null) via.current = how;
    setOpenId(id);
  }, []);
  const lastVia = useCallback(() => via.current, []);
  return { openId, openFor, lastVia };
}

/**
 * The row-level handlers that open a row's menu: the menu key on the focused
 * row (`isRowMenuKey`), and a right-click when the view draws its actions
 * in a menu. `keyDown` returns `true` when it took the key.
 */
export function rowMenuHandlers(
  rowActions: RowActions | undefined,
  menu: RowMenuState,
  row: Row,
  opts: { contextMenu: boolean },
) {
  const has = () => rowActions !== undefined && rowActions.eligible(row).length > 0;
  return {
    keyDown: (e: KeyboardEvent<HTMLElement>): boolean => {
      if (!rowActions || e.defaultPrevented || e.target !== e.currentTarget) return false;
      if (!isRowMenuKey(e) || !has()) return false;
      e.preventDefault();
      menu.openFor(row.__meta.id, "key");
      return true;
    },
    contextMenu:
      rowActions && opts.contextMenu
        ? (e: MouseEvent<HTMLElement>) => {
            if (e.defaultPrevented || ownsKeys(e.target) || !has()) return;
            const own = (e.target as Element | null)?.closest?.("a,input,textarea,select");
            if (own) return;
            e.preventDefault();
            menu.openFor(row.__meta.id, "context");
          }
        : undefined,
  };
}

/** The width of an icon button of the inline strip, and of the "more" button. */
const ICON_BUTTON = 28;
const LABEL_CHAR = 7;
const LABEL_PADDING = 16;
const CELL_PADDING = 12;
const MENU_COLUMN = 40;

/**
 * The trailing column's width, from every declared action (not one row's
 * eligible subset, so the column does not jump as rows change). As in
 * udc-js, actions with a `when` count as alternatives: only the widest.
 */
export function rowActionsColumnWidth(rowActions: RowActions): number {
  if (rowActions.display === "menu") return MENU_COLUMN;
  const widthOf = (def: ActionDef) =>
    hasIcon(def)
      ? ICON_BUTTON
      : Math.ceil(rowActions.label(def).length * LABEL_CHAR) + LABEL_PADDING;
  const always = rowActions.defs.filter((d) => d.when === undefined);
  const alternatives = rowActions.defs.filter((d) => d.when !== undefined);
  const buttons =
    always.reduce((sum, d) => sum + widthOf(d) + 2, 0) +
    (alternatives.length > 0 ? Math.max(...alternatives.map(widthOf)) + 2 : 0);
  return Math.max(MENU_COLUMN, buttons + CELL_PADDING);
}

function iconOf(def: ActionDef) {
  return actionIcon(def.icon) ?? (def.kind === "delete" ? Trash2 : null);
}

function hasIcon(def: ActionDef): boolean {
  return iconOf(def) !== null;
}

const stop = (e: SyntheticEvent) => e.stopPropagation();

export interface RowActionsControlsProps {
  row: Row;
  rowActions: RowActions;
  menu: RowMenuState;
  /** `menu`: one "more" button whatever the view says (the cards). Default: `rowActions.display`. */
  display?: "inline" | "menu";
  className?: string;
}

/**
 * One row's actions. A click, a key or a right-click inside never reaches the
 * row: it neither activates it, nor follows its `row_link`, nor selects it.
 */
export function RowActionsControls({
  row,
  rowActions,
  menu,
  display = rowActions.display,
  className,
}: RowActionsControlsProps) {
  const { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, Spinner, Tip } =
    useUiKit();
  const { t } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const actions = rowActions.eligible(row);
  if (actions.length === 0) return null;
  const id = row.__meta.id;
  const running = rowActions.runningOn(id);
  const open = menu.openId === id;

  const run = (def: ActionDef) => void rowActions.run(def, row);
  const items = actions.map((def) => {
    const Icon = iconOf(def);
    return (
      <DropdownMenuItem
        key={def.kind}
        data-testid={`row-action-item-${def.kind}`}
        tone={def.variant === "destructive" || def.kind === "delete" ? "danger" : "default"}
        disabled={running !== null}
        onSelect={() => run(def)}
      >
        {Icon ? <Icon /> : null}
        {rowActions.label(def)}
      </DropdownMenuItem>
    );
  });

  const dropdown = (trigger: "button" | "hidden") => (
    <DropdownMenu
      modal={false}
      open={open}
      onOpenChange={(next) => menu.openFor(next ? id : null, "trigger")}
    >
      {trigger === "button" ? (
        <DropdownMenuTrigger
          data-testid="row-actions-more"
          aria-label={t("APP", "ROW_ACTIONS_MORE")}
          className={cn(
            "udc:grid udc:size-7 udc:shrink-0 udc:place-items-center udc:rounded-md udc:text-muted-foreground udc:outline-none udc:transition-colors",
            "udc:hover:bg-border/70 udc:hover:text-foreground udc:focus-visible:ring-2 udc:focus-visible:ring-ring udc:data-[state=open]:bg-border/70 udc:data-[state=open]:text-foreground",
          )}
        >
          {running !== null ? <Spinner /> : <EllipsisVertical className="udc:size-4" />}
        </DropdownMenuTrigger>
      ) : (
        <DropdownMenuTrigger asChild>
          <span aria-hidden tabIndex={-1} className="udc:block udc:size-0 udc:overflow-hidden" />
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent
        align="end"
        data-testid="row-actions-menu"
        onCloseAutoFocus={(e) => {
          if (menu.lastVia() === "trigger") return;
          // Opened from the row (a key, a right-click): the focus goes back to the row.
          const rowEl = box.current?.closest<HTMLElement>("[data-row-id]");
          if (rowEl?.hasAttribute("tabindex")) {
            e.preventDefault();
            rowEl.focus({ preventScroll: true });
          }
        }}
      >
        {items}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div
      ref={box}
      role="toolbar"
      aria-label={t("APP", "ROW_ACTIONS")}
      data-testid="row-actions"
      data-display={display}
      onClick={stop}
      onAuxClick={stop}
      onDoubleClick={stop}
      onKeyDown={stop}
      onContextMenu={stop}
      className={cn("udc:flex udc:items-center udc:justify-end udc:gap-0.5", className)}
    >
      {display === "menu"
        ? dropdown("button")
        : [
            ...actions.map((def) => {
              const Icon = iconOf(def);
              const name = rowActions.label(def);
              const busy = running === def.kind;
              const button = (
                <button
                  key={def.kind}
                  type="button"
                  data-testid={`row-action-${def.kind}`}
                  aria-label={name}
                  disabled={running !== null}
                  onClick={() => run(def)}
                  className={cn(
                    "udc:inline-flex udc:h-7 udc:shrink-0 udc:items-center udc:justify-center udc:rounded-md udc:outline-none udc:transition-colors udc:disabled:opacity-50",
                    "udc:focus-visible:ring-2 udc:focus-visible:ring-ring",
                    Icon ? "udc:w-7" : "udc:px-2 udc:text-xs udc:font-medium",
                    def.variant === "destructive" || def.kind === "delete"
                      ? "udc:text-sem-danger udc:hover:bg-sem-danger-bg"
                      : "udc:text-muted-foreground udc:hover:bg-border/70 udc:hover:text-foreground",
                  )}
                >
                  {busy ? <Spinner /> : Icon ? <Icon className="udc:size-4" /> : name}
                </button>
              );
              return Icon ? (
                <Tip key={def.kind} label={name}>
                  {button}
                </Tip>
              ) : (
                <span key={def.kind}>{button}</span>
              );
            }),
            <span key="__menu">{dropdown("hidden")}</span>,
          ]}
    </div>
  );
}
