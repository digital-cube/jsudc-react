// What runs a row action (0.5.0): the bulk path of `BulkBar` (`planBulkAction`, the same
// handlers, `useUdcMutateMany`, `callAction`) on a selection of one row, plus its confirmation.
import {
  type ActionDef,
  actionConfirms,
  type Capabilities,
  isUdcError,
  type MutateManyResponse,
  type Row,
} from "@jsudc/core";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n/i18n.js";
import { humanize } from "../lib/utils.js";
import type { RowSelection } from "../rows/useRowSelection.js";
import { busyToast } from "../udc/busy.js";
import { useUdcClient } from "../udc/client.js";
import { callAction, useUdcMutate, useUdcMutateMany } from "../udc/hooks.js";
import { udcKeys } from "../udc/keys.js";
import { useUiKit } from "../ui-kit/context.js";
import {
  type BulkActionHandlers,
  type BulkActionPlan,
  planBulkAction,
  useBulkActionHandlers,
} from "./bulk.js";
import {
  DEFAULT_ROW_ACTIONS_MAX,
  eligibleRowActions,
  type RowActions,
  type RowActionsDisplay,
  splitRowActions,
} from "./row.js";
import { rowActionHasIcon } from "./rowIcon.js";

export interface UseRowActionRunnerOptions {
  collection: string;
  /** The collection's i18n section (`TBL_<COLLECTION>`). */
  section: string;
  /** What the view declares (`rowActionDefs(view)`); empty: no row actions. */
  defs: readonly ActionDef[];
  display: RowActionsDisplay;
  /** The most buttons of the `hover` bar (`rowActionsMax(view)`); default 4. */
  max?: number | undefined;
  capabilities: Pick<Capabilities, "mutate" | "mutate_many"> | undefined;
  /** The view's own handlers (`UdcDataView actions`), before the provider's. */
  handlers?: BulkActionHandlers | undefined;
  /** The view's selection, when it selects: a deleted row leaves it, a handler may clear it. */
  selection?: RowSelection | undefined;
}

type Pending = { def: ActionDef; plan: BulkActionPlan; label: string; row: Row };

const NOOP = () => {};

/**
 * The `RowActions` a data view hands its renderer (`undefined` when the view
 * declares none) and the confirmation dialog to mount beside it.
 */
export function useRowActionRunner({
  collection,
  section,
  defs,
  display,
  max = DEFAULT_ROW_ACTIONS_MAX,
  capabilities,
  handlers,
  selection,
}: UseRowActionRunnerOptions): { rowActions: RowActions | undefined; dialog: ReactNode } {
  const { Button, Dialog, DialogContent, DialogBody, DialogFooter, useToast } = useUiKit();
  const { toast } = useToast();
  const { t, tMaybe } = useI18n();
  const provided = useBulkActionHandlers();
  const client = useUdcClient();
  const qc = useQueryClient();
  const mutate = useUdcMutate(collection);
  const mutateMany = useUdcMutateMany(collection);
  const [pending, setPending] = useState<Pending | null>(null);
  const [running, setRunning] = useState<{ id: string; kind: string } | null>(null);

  // The latest values, for the stable `run` a renderer may keep.
  const latest = useRef({ handlers, provided, selection, capabilities });
  latest.current = { handlers, provided, selection, capabilities };

  const label = useCallback(
    (def: ActionDef) =>
      tMaybe(section, `ACTION_${def.kind.toUpperCase()}`) ??
      tMaybe("ACTIONS", def.kind) ??
      def.label ??
      (def.kind === "delete" ? t("APP", "BULK_DELETE") : humanize(def.kind)),
    [t, tMaybe, section],
  );

  const failedToast = useCallback(
    (name: string, err: unknown, plan: BulkActionPlan) => {
      const busy = busyToast(err, t);
      if (busy) {
        toast(busy);
        return;
      }
      if (isUdcError(err) && err.code === "unsupported_op") {
        toast({
          variant: "danger",
          title: t("APP", "BULK_UNSUPPORTED", { action: name }),
          description: plan.via === "server" ? `udc.${plan.action}` : err.message,
        });
        return;
      }
      toast({
        variant: "danger",
        title: t("APP", "BULK_FAILED", { action: name }),
        description: err instanceof Error ? err.message : String(err),
      });
    },
    [t, toast],
  );

  /** A `mutate_many`-shaped answer naming the row as failed is an error too. */
  const settle = useCallback(
    (name: string, res: unknown) => {
      const failed = (res as Partial<MutateManyResponse> | null)?.failed;
      const first = Array.isArray(failed) ? failed[0] : undefined;
      if (!first) return true;
      toast({
        variant: "danger",
        title: t("APP", "BULK_FAILED", { action: name }),
        description: first.message ?? first.code,
      });
      return false;
    },
    [t, toast],
  );

  const execute = useCallback(
    async ({ def, plan, label: name, row }: Pending) => {
      const id = row.__meta.id;
      const { selection: sel, capabilities: caps } = latest.current;
      const many = caps?.mutate_many === true;
      setRunning({ id, kind: def.kind });
      try {
        if (plan.via === "host") {
          await plan.handler({
            kind: def.kind,
            def,
            collection,
            ids: [id],
            rows: [row],
            row,
            clearSelection: sel?.clear ?? NOOP,
          });
        } else if (plan.via === "delete") {
          let ok = true;
          if (many) ok = settle(name, await mutateMany.mutateAsync({ op: "delete", ids: [id] }));
          else await mutate.mutateAsync({ op: "delete", id });
          // A deleted row leaves the selection.
          if (ok && sel?.mode === "ids" && sel.ids.includes(id)) {
            sel.setIds(sel.ids.filter((x) => x !== id));
          }
        } else if (plan.via === "set") {
          if (many) {
            settle(
              name,
              await mutateMany.mutateAsync({ op: "update", ids: [id], row: plan.patch }),
            );
          } else {
            await mutate.mutateAsync({ op: "update", id, row: plan.patch });
          }
        } else {
          try {
            settle(name, await callAction(client, plan.action, { collection, ids: [id] }));
          } finally {
            await Promise.all([
              qc.invalidateQueries({ queryKey: udcKeys.lists(collection) }),
              qc.invalidateQueries({ queryKey: udcKeys.lookups(collection) }),
            ]);
          }
        }
      } catch (err) {
        failedToast(name, err, plan);
      } finally {
        setRunning(null);
      }
    },
    [client, collection, failedToast, mutate, mutateMany, qc, settle],
  );

  const run = useCallback(
    async (def: ActionDef, row: Row) => {
      const { handlers: own, provided: fallback } = latest.current;
      const plan = planBulkAction(def, own, fallback);
      const job: Pending = { def, plan, label: label(def), row };
      // A host's handler asks its own questions; the built-in paths ask per `confirm`.
      if (plan.via !== "host" && actionConfirms(def)) setPending(job);
      else await execute(job);
    },
    [execute, label],
  );

  const rowActions = useMemo<RowActions | undefined>(
    () =>
      defs.length === 0
        ? undefined
        : {
            display,
            defs,
            eligible: (row: Row) => eligibleRowActions(defs, row),
            split: (row: Row) =>
              splitRowActions(eligibleRowActions(defs, row), { hasIcon: rowActionHasIcon, max }),
            label,
            run,
            runningOn: (rowId: string) => (running?.id === rowId ? running.kind : null),
          },
    [defs, display, max, label, run, running],
  );

  const confirmTitle = (p: Pending) => {
    if (typeof p.def.confirm === "string") return p.def.confirm;
    return p.plan.via === "delete"
      ? t("APP", "ROW_CONFIRM_DELETE")
      : t("APP", "ROW_CONFIRM_ACTION", { action: p.label });
  };

  const dialog =
    defs.length === 0 ? null : (
      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        {pending ? (
          <DialogContent
            role="alertdialog"
            data-testid="row-action-confirm"
            title={confirmTitle(pending)}
          >
            <DialogBody className="udc:text-[13px] udc:text-muted-foreground">
              {pending.plan.via === "delete" ? t("APP", "BULK_CONFIRM_DELETE_BODY") : pending.label}
            </DialogBody>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setPending(null)}>
                {t("APP", "CANCEL")}
              </Button>
              <Button
                variant={pending.plan.via === "delete" ? "danger" : "primary"}
                data-testid="row-action-confirm-ok"
                onClick={() => {
                  const job = pending;
                  setPending(null);
                  void execute(job);
                }}
              >
                {pending.plan.via === "delete" ? t("APP", "BULK_DELETE") : t("APP", "BULK_CONFIRM")}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    );

  return { rowActions, dialog };
}
