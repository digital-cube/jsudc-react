import type { CalendarOptions, DescribeResponse } from "@jsudc/core";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { tableSection, useI18n } from "../i18n/i18n";
import { CellEditor, editorKind, fromEditorValue, sameValue } from "../table/CellEditor";
import { CellValue } from "../table/cells";
import { formatDay, formatTime, zonedParts } from "../time/zoned";
import { useUiKit } from "../ui-kit/context";
import { eventTint } from "./EventBlock";
import type { CalendarEvent } from "./model";

/**
 * The popover a clicked event opens: its time in the display zone, then
 * `detail.fields` as the table formats them; the ones marked `editable` edit
 * in place with the table's cell editor. Delete, when `detail.delete`, asks
 * once more before it deletes.
 */
export function EventDetail({
  ev,
  anchor,
  collection,
  describe,
  opts,
  timeZone,
  readOnly,
  onClose,
  onSave,
  onDelete,
}: {
  ev: CalendarEvent;
  anchor: HTMLElement;
  collection: string;
  describe: DescribeResponse;
  opts: CalendarOptions;
  timeZone: string;
  readOnly: boolean;
  onClose: () => void;
  onSave: (field: string, value: unknown) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const { Button, Popover, PopoverAnchor, PopoverContent } = useUiKit();
  const { t, locale, intlLocale } = useI18n();
  const { schema, view } = describe;
  const section = tableSection(collection);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ message: string; seq: number } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const fields = (opts.detail?.fields ?? [{ field: opts.title_field }]).filter(
    (f) => schema.fields[f.field] && !schema.fields[f.field]?.deleted,
  );

  const sameDate = (() => {
    const a = zonedParts(ev.start, timeZone);
    const b = zonedParts(ev.end - 1, timeZone);
    return a.y === b.y && a.m === b.m && a.d === b.d;
  })();
  const dateOf = (instant: number) => {
    const p = zonedParts(instant, timeZone);
    return formatDay(p, intlLocale, { weekday: "short", day: "numeric", month: "short" });
  };
  const when = sameDate
    ? `${dateOf(ev.start)}, ${formatTime(ev.start, intlLocale, timeZone)} – ${formatTime(ev.end, intlLocale, timeZone)}`
    : `${dateOf(ev.start)} ${formatTime(ev.start, intlLocale, timeZone)} – ${dateOf(ev.end)} ${formatTime(ev.end, intlLocale, timeZone)}`;

  const commit = async (field: string, raw: string | boolean) => {
    const def = schema.fields[field];
    const parsed = fromEditorValue(raw, editorKind(def), def);
    if ("error" in parsed) {
      setError((e) => ({ message: parsed.error, seq: (e?.seq ?? 0) + 1 }));
      return;
    }
    if (sameValue(parsed.value, ev.row[field])) {
      setEditing(null);
      return;
    }
    setSaving(true);
    try {
      await onSave(field, parsed.value);
      setEditing(null);
      setError(null);
    } catch (err) {
      setError((e) => ({ message: (err as Error).message, seq: (e?.seq ?? 0) + 1 }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open onOpenChange={(open) => !open && onClose()}>
      <PopoverAnchor virtualRef={{ current: anchor }} />
      <PopoverContent
        side="right"
        align="start"
        collisionPadding={12}
        className="udc:w-80 udc:p-0"
        data-testid="cal-detail"
        data-event-id={ev.id}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div
          className="udc:rounded-t-lg udc:border-b udc:border-l-4 udc:border-border udc:px-3 udc:py-2.5"
          style={eventTint(ev.color, 12)}
        >
          <div
            className="udc:text-sm udc:leading-snug udc:font-semibold"
            data-testid="cal-detail-title"
          >
            {ev.title}
          </div>
          <div
            className="udc:mt-0.5 udc:text-xs udc:text-muted-foreground udc:tabular-nums"
            data-testid="cal-detail-when"
          >
            {when}
          </div>
        </div>
        <dl className="udc:grid udc:grid-cols-[minmax(5.5rem,auto)_1fr] udc:gap-x-3 udc:px-3 udc:py-1">
          {fields.map(({ field, editable }) => {
            const def = schema.fields[field];
            const canEdit = editable === true && !readOnly;
            const column = view.columns.find((c) => c.field === field) ?? { field };
            return (
              <div key={field} className="udc:contents" data-testid={`cal-detail-${field}`}>
                <dt className="udc:border-b udc:border-dashed udc:border-border/80 udc:py-2 udc:text-xs udc:text-muted-foreground">
                  {t(section, field)}
                </dt>
                <dd className="udc:relative udc:min-w-0 udc:border-b udc:border-dashed udc:border-border/80 udc:py-1.5 udc:text-[13px]">
                  {editing === field ? (
                    <div className="udc:relative udc:h-7">
                      <CellEditor
                        def={def}
                        initial={ev.row[field]}
                        saving={saving}
                        error={error?.message ?? null}
                        errorSeq={error?.seq ?? 0}
                        onCommit={(raw) => void commit(field, raw)}
                        onCancel={() => {
                          setEditing(null);
                          setError(null);
                        }}
                      />
                    </div>
                  ) : canEdit ? (
                    <button
                      type="button"
                      data-testid={`cal-detail-edit-${field}`}
                      onClick={() => setEditing(field)}
                      className="udc:group/edit udc:flex udc:min-h-7 udc:w-full udc:min-w-0 udc:items-center udc:gap-1.5 udc:rounded udc:px-1 udc:-mx-1 udc:text-left udc:hover:bg-hover"
                    >
                      <span className="udc:min-w-0 udc:flex-1">
                        <CellValue
                          value={ev.row[field]}
                          column={column}
                          def={def}
                          locale={locale}
                          intlLocale={intlLocale}
                        />
                      </span>
                      <Pencil className="udc:size-3 udc:shrink-0 udc:text-muted-foreground udc:opacity-0 udc:group-hover/edit:opacity-100" />
                    </button>
                  ) : (
                    <div className="udc:flex udc:min-h-7 udc:items-center">
                      <CellValue
                        value={ev.row[field]}
                        column={column}
                        def={def}
                        locale={locale}
                        intlLocale={intlLocale}
                      />
                    </div>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
        {opts.detail?.delete && !readOnly ? (
          <div className="udc:flex udc:items-center udc:justify-end udc:gap-2 udc:px-3 udc:py-2.5">
            {confirming ? (
              <>
                <span className="udc:mr-auto udc:text-xs udc:text-muted-foreground">
                  {t("APP", "CAL_DELETE_CONFIRM")}
                </span>
                <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                  {t("APP", "CAL_CANCEL")}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  data-testid="cal-delete-confirm"
                  onClick={() => void onDelete()}
                >
                  {t("APP", "CAL_DELETE")}
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                data-testid="cal-delete"
                className="udc:text-sem-danger udc:hover:text-sem-danger"
                onClick={() => setConfirming(true)}
              >
                <Trash2 />
                {t("APP", "CAL_DELETE")}
              </Button>
            )}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
