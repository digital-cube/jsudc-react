import {
  type ActionDef,
  actionConfirms,
  type FilterNode,
  isUdcError,
  type MutateManyResponse,
} from "@jsudc/core";
import { useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Check,
  Clock,
  Flag,
  FolderInput,
  type LucideIcon,
  Mail,
  MailOpen,
  Star,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import {
  type BulkActionHandlers,
  type BulkActionPlan,
  bulkActionEligible,
  planBulkAction,
  selectionTarget,
  useBulkActionHandlers,
} from "../actions/bulk.js";
import { useI18n } from "../i18n/i18n.js";
import { FALLBACK_ICON, resolveIcon } from "../icons/resolve.js";
import { humanize } from "../lib/utils.js";
import type { RowSelection } from "../rows/useRowSelection.js";
import { busyToast } from "../udc/busy.js";
import { useUdcClient } from "../udc/client.js";
import { callAction, useUdcMutateMany } from "../udc/hooks.js";
import { udcKeys } from "../udc/keys.js";
import { useUiKit } from "../ui-kit/context.js";
import type { ButtonVariant } from "../ui-kit/types.js";

export interface BulkBarProps {
  collection: string;
  /** The collection's i18n section (`TBL_<COLLECTION>`). */
  section: string;
  /** `view.bulk_actions`; none: the bar only counts and clears. */
  defs: readonly ActionDef[];
  selection: RowSelection;
  /** The list's filter, composed: what "all that match" sends. */
  filter: FilterNode | undefined;
  /** More rows match than are loaded: "select all that match" is worth offering. */
  moreThanLoaded: boolean;
  /** The list's total; `null` when the source does not count. */
  total: number | null;
  /** The view's own handlers (`UdcDataView actions`), before the provider's. */
  handlers?: BulkActionHandlers | undefined;
  /**
   * `false`: "select all that match" is not offered, and a short hint says
   * why. `UdcDataView` sets it while the source answers the search (0.5.0):
   * `mutate_many` by filter cannot carry the search text, so it could not
   * name the same set. Default `true`.
   */
  allMatching?: boolean | undefined;
}

const VARIANT: Record<NonNullable<ActionDef["variant"]>, ButtonVariant> = {
  default: "primary",
  outline: "outline",
  destructive: "danger",
};

/** The icons a mailbox's bulk actions name most, beyond the bundled `LUCIDE_ICONS`. */
const ACTION_ICONS: Readonly<Record<string, LucideIcon>> = {
  archive: Archive,
  check: Check,
  clock: Clock,
  flag: Flag,
  "folder-input": FolderInput,
  mail: Mail,
  "mail-open": MailOpen,
  star: Star,
  tag: Tag,
  "trash-2": Trash2,
};

/** A def's `icon` (`lucide:<name>` or a bare name), or none when the name is not known. */
export function actionIcon(name: string | undefined): LucideIcon | null {
  if (!name) return null;
  const bare = name.startsWith("lucide:") ? name.slice("lucide:".length) : name;
  const own = ACTION_ICONS[bare];
  if (own) return own;
  const icon = resolveIcon(`lucide:${bare}`);
  return icon === FALLBACK_ICON ? null : icon;
}

type Pending = { def: ActionDef; plan: BulkActionPlan; label: string };

/**
 * The bar over the list while rows are selected: the count (or "all
 * matching"), the offer to select every row that matches, one button per
 * `view.bulk_actions` entry, and a clear button. Runs an action through the
 * host's handler for its `kind`, else on the server (`planBulkAction`).
 */
export function BulkBar({
  collection,
  section,
  defs,
  selection,
  filter,
  moreThanLoaded,
  total,
  handlers,
  allMatching = true,
}: BulkBarProps) {
  const { Button, Dialog, DialogContent, DialogBody, DialogFooter, Spinner, useToast } = useUiKit();
  const { toast } = useToast();
  const { t, tMaybe, intlLocale } = useI18n();
  const provided = useBulkActionHandlers();
  const client = useUdcClient();
  const qc = useQueryClient();
  const mutateMany = useUdcMutateMany(collection);
  const [pending, setPending] = useState<Pending | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const fmt = (n: number) => new Intl.NumberFormat(intlLocale).format(n);

  const labelOf = (def: ActionDef) =>
    tMaybe(section, `ACTION_${def.kind.toUpperCase()}`) ??
    tMaybe("ACTIONS", def.kind) ??
    def.label ??
    (def.kind === "delete" ? t("APP", "BULK_DELETE") : humanize(def.kind));

  const { count, mode } = selection;
  const countText =
    mode === "ids"
      ? t("APP", "SELECTED_COUNT", { count: fmt(count ?? 0) })
      : count === null
        ? t("APP", "SELECTED_ALL_MATCHING")
        : t("APP", "SELECTED_ALL_COUNT", { count: fmt(count) });
  const couldOfferAll = mode === "ids" && selection.pageState === "all" && moreThanLoaded;
  const offerAll = couldOfferAll && allMatching;

  /** Report a `mutate_many`-shaped answer and settle the selection. */
  const report = (def: ActionDef, label: string, res: Partial<MutateManyResponse>) => {
    const failed = Array.isArray(res.failed) ? res.failed : [];
    const updated = typeof res.updated === "number" ? res.updated : null;
    const done =
      updated === null
        ? t("APP", "BULK_DONE", { action: label })
        : def.kind === "delete"
          ? t("APP", "BULK_DELETED_COUNT", { count: fmt(updated) })
          : t("APP", "BULK_DONE_COUNT", { action: label, count: fmt(updated) });
    if (failed.length > 0) {
      toast({
        variant: "warning",
        title: t("APP", "BULK_FAILED_COUNT", { count: fmt(failed.length) }),
        description: done,
      });
      // The rows that did not change stay selected, to retry or look at.
      if (selection.mode === "ids") {
        const chosen = new Set(selection.ids);
        selection.setIds(failed.map((f) => f.id).filter((id) => chosen.has(id)));
      } else selection.clear();
      return;
    }
    toast({ variant: "success", title: done });
    selection.clear();
  };

  const execute = async ({ def, plan, label }: Pending) => {
    const target = selectionTarget(selection, filter);
    setRunning(def.kind);
    try {
      if (plan.via === "host") {
        await plan.handler({
          kind: def.kind,
          def,
          collection,
          ...("ids" in target
            ? { ids: target.ids }
            : { filter: target.filter, exceptIds: target.except_ids ?? [] }),
          rows: [...selection.rows],
          clearSelection: selection.clear,
        });
      } else if (plan.via === "delete") {
        report(def, label, await mutateMany.mutateAsync({ op: "delete", ...target }));
      } else if (plan.via === "set") {
        report(
          def,
          label,
          await mutateMany.mutateAsync({ op: "update", row: plan.patch, ...target }),
        );
      } else {
        try {
          const answer = await callAction(client, plan.action, { collection, ...target });
          report(
            def,
            label,
            typeof answer === "object" && answer !== null
              ? (answer as Partial<MutateManyResponse>)
              : {},
          );
        } finally {
          await Promise.all([
            qc.invalidateQueries({ queryKey: udcKeys.lists(collection) }),
            qc.invalidateQueries({ queryKey: udcKeys.lookups(collection) }),
          ]);
        }
      }
    } catch (err) {
      const busy = busyToast(err, t);
      if (busy) {
        toast(busy);
        return;
      }
      if (isUdcError(err) && err.code === "unsupported_op") {
        toast({
          variant: "danger",
          title: t("APP", "BULK_UNSUPPORTED", { action: label }),
          description: plan.via === "server" ? `udc.${plan.action}` : err.message,
        });
      } else {
        toast({
          variant: "danger",
          title: t("APP", "BULK_FAILED", { action: label }),
          description: err instanceof Error ? err.message : String(err),
        });
      }
    } finally {
      setRunning(null);
    }
  };

  const run = (def: ActionDef) => {
    const plan = planBulkAction(def, handlers, provided);
    const job = { def, plan, label: labelOf(def) };
    // A host's handler asks its own questions; the built-in paths ask per `confirm`.
    if (plan.via !== "host" && actionConfirms(def)) setPending(job);
    else void execute(job);
  };

  const confirmTitle = (p: Pending) => {
    if (typeof p.def.confirm === "string") return p.def.confirm;
    const n = selection.count;
    if (p.plan.via === "delete") {
      return n === null
        ? t("APP", "BULK_CONFIRM_DELETE_MATCHING")
        : t("APP", "BULK_CONFIRM_DELETE_COUNT", { count: fmt(n) });
    }
    return n === null
      ? t("APP", "BULK_CONFIRM_ACTION_MATCHING", { action: p.label })
      : t("APP", "BULK_CONFIRM_ACTION_COUNT", { action: p.label, count: fmt(n) });
  };

  return (
    <>
      <div
        role="toolbar"
        aria-label={t("APP", "BULK_ACTIONS")}
        data-testid="bulk-bar"
        data-mode={mode}
        className="udc-bulk-bar udc:flex udc:flex-wrap udc:items-center udc:gap-2 udc:border-b udc:border-border udc:bg-selected udc:px-3 udc:py-1.5 udc:text-[13px]"
      >
        <span
          data-testid="bulk-count"
          data-count={count ?? undefined}
          aria-live="polite"
          className="udc:font-medium udc:tabular-nums"
        >
          {countText}
        </span>
        {offerAll ? (
          <Button
            size="sm"
            variant="ghost"
            data-testid="select-all-matching"
            className="udc:text-primary"
            onClick={selection.selectAllMatching}
          >
            {total === null
              ? t("APP", "SELECT_ALL_MATCHING")
              : t("APP", "SELECT_ALL_MATCHING_COUNT", { count: fmt(total) })}
          </Button>
        ) : couldOfferAll ? (
          <span data-testid="select-all-matching-off" className="udc:text-muted-foreground">
            {t("APP", "SELECT_ALL_MATCHING_SEARCH")}
          </span>
        ) : null}
        <div className="udc:ml-auto udc:flex udc:flex-wrap udc:items-center udc:gap-1.5">
          {defs.map((def) => {
            const label = labelOf(def);
            const eligible = bulkActionEligible(def, selection);
            const Icon = actionIcon(def.icon);
            return (
              <span key={def.kind} title={eligible ? undefined : t("APP", "BULK_NOT_ELIGIBLE")}>
                <Button
                  size="sm"
                  variant={
                    def.variant
                      ? VARIANT[def.variant]
                      : def.kind === "delete"
                        ? "danger"
                        : "outline"
                  }
                  data-testid={`bulk-action-${def.kind}`}
                  disabled={!eligible || running !== null}
                  onClick={() => run(def)}
                >
                  {running === def.kind ? <Spinner /> : Icon ? <Icon /> : null}
                  {label}
                </Button>
              </span>
            );
          })}
          <Button
            size="icon-sm"
            variant="ghost"
            data-testid="bulk-clear"
            aria-label={t("APP", "SELECTION_CLEAR")}
            onClick={selection.clear}
          >
            <X />
          </Button>
        </div>
      </div>
      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        {pending ? (
          <DialogContent
            role="alertdialog"
            data-testid="bulk-confirm"
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
                data-testid="bulk-confirm-ok"
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
    </>
  );
}
