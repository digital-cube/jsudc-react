import type { DescribeResponse, Row } from "@jsudc/core";
import { tableSection, useI18n } from "../i18n/i18n.js";
import { CellValue } from "../table/cells.js";
import { useUiKit } from "../ui-kit/context.js";

/**
 * A card, read-only: its title and body, then every live field as the table
 * formats it; the board and bucket ids read as their names. The tree opens
 * its nodes in it too, naming its own title and body fields.
 */
export function CardDetailDialog({
  row,
  describe,
  collection,
  labels,
  onClose,
  titleField = describe.view.kanban_options?.card.title_field,
  bodyField = describe.view.kanban_options?.card.body_field,
  testId = "kanban-detail",
}: {
  row: Row | undefined;
  describe: DescribeResponse;
  collection: string;
  /** Names for id fields the board knows (the board and the bucket), by field. */
  labels: Record<string, ReadonlyMap<string, string>>;
  onClose: () => void;
  titleField?: string | undefined;
  bodyField?: string | undefined;
  testId?: string;
}) {
  const { Dialog, DialogBody, DialogContent } = useUiKit();
  const { t, locale, intlLocale } = useI18n();
  const { schema, view } = describe;
  const section = tableSection(collection);
  const fields = schema.field_order.filter(
    (f) => !schema.fields[f]?.deleted && f !== titleField && f !== bodyField,
  );
  const body = row && bodyField ? row[bodyField] : null;

  return (
    <Dialog open={row !== undefined} onOpenChange={(open) => !open && onClose()}>
      {row ? (
        <DialogContent
          data-testid={testId}
          className="udc:max-w-lg"
          title={String((titleField && row[titleField]) || "—")}
        >
          <DialogBody>
            {typeof body === "string" && body ? (
              <p className="udc:mb-4 udc:text-[13px] udc:leading-relaxed udc:whitespace-pre-wrap udc:text-muted-foreground">
                {body}
              </p>
            ) : null}
            <dl className="udc:grid udc:grid-cols-[minmax(7rem,auto)_1fr] udc:gap-x-4 udc:border-t udc:border-border">
              {fields.map((field) => (
                <div key={field} className="udc:contents" data-testid={`${testId}-${field}`}>
                  <dt className="udc:border-b udc:border-dashed udc:border-border/80 udc:py-2 udc:text-xs udc:text-muted-foreground">
                    {t(section, field)}
                  </dt>
                  <dd className="udc:min-w-0 udc:border-b udc:border-dashed udc:border-border/80 udc:py-2 udc:text-[13px]">
                    <CellValue
                      value={labels[field]?.get(String(row[field])) ?? row[field]}
                      column={view.columns.find((c) => c.field === field) ?? { field }}
                      def={schema.fields[field]}
                      locale={locale}
                      intlLocale={intlLocale}
                    />
                  </dd>
                </div>
              ))}
            </dl>
          </DialogBody>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
