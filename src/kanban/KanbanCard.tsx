import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ColumnColor, KanbanOptions, Row, SchemaDoc } from "@jsudc/core";
import { CalendarDays } from "lucide-react";
import type { CSSProperties, KeyboardEvent } from "react";
import { avatarTone, initials } from "../cards/cardModel";
import { useI18n } from "../i18n/i18n";
import { cn } from "../lib/utils";
import { formatDate } from "../table/format";
import { useUiKit } from "../ui-kit/context";
import { isOverdue, priorityTone } from "./model";

/** Literal classes, so Tailwind sees them. */
export const TONE_BORDER: Record<ColumnColor, string> = {
  default: "udc:border-l-border-strong",
  accent: "udc:border-l-sem-accent",
  success: "udc:border-l-sem-success",
  warning: "udc:border-l-sem-warning",
  danger: "udc:border-l-sem-danger",
  info: "udc:border-l-sem-info",
  muted: "udc:border-l-sem-muted/60",
};

export const TONE_DOT: Record<ColumnColor, string> = {
  default: "udc:bg-border-strong",
  accent: "udc:bg-sem-accent",
  success: "udc:bg-sem-success",
  warning: "udc:bg-sem-warning",
  danger: "udc:bg-sem-danger",
  info: "udc:bg-sem-info",
  muted: "udc:bg-sem-muted",
};

const AVATAR: Record<ColumnColor, string> = {
  default: "udc:bg-muted udc:text-muted-foreground",
  accent: "udc:bg-sem-accent-bg udc:text-sem-accent",
  success: "udc:bg-sem-success-bg udc:text-sem-success",
  warning: "udc:bg-sem-warning-bg udc:text-sem-warning",
  danger: "udc:bg-sem-danger-bg udc:text-sem-danger",
  info: "udc:bg-sem-info-bg udc:text-sem-info",
  muted: "udc:bg-sem-muted-bg udc:text-sem-muted",
};

const MAX_AVATARS = 3;

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x !== "") : [];

const clamp = (lines: number): CSSProperties => ({
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: lines,
  overflow: "hidden",
});

export interface KanbanCardBodyProps {
  row: Row;
  opts: KanbanOptions;
  schema: SchemaDoc;
}

/** What a card shows; the sortable wrapper and the drag overlay both draw it. */
export function KanbanCardBody({ row, opts, schema }: KanbanCardBodyProps) {
  const { t, intlLocale } = useI18n();
  const { card, cards } = opts;
  const title = String(row[card.title_field] ?? "");
  const body = card.body_field ? row[card.body_field] : null;
  const priority = card.priority_field ? row[card.priority_field] : null;
  const tone = card.priority_field
    ? priorityTone(priority, schema.fields[card.priority_field])
    : null;
  const tags = card.tags_field ? strings(row[card.tags_field]) : [];
  const shownTags = tags.slice(0, cards.tags_max_visible);
  const due = card.due_field ? row[card.due_field] : null;
  const overdue = isOverdue(due);
  const people = card.assignees_field ? strings(row[card.assignees_field]) : [];
  const footer = (card.footer_fields ?? [])
    .map((f) => row[f])
    .filter((v) => v !== null && v !== undefined && v !== "");
  const compact = cards.density === "compact";

  return (
    <div
      className={cn(
        "udc:flex udc:flex-col",
        compact ? "udc:gap-1.5 udc:px-2.5 udc:py-2" : "udc:gap-2 udc:px-3 udc:py-2.5",
      )}
    >
      <div className="udc:flex udc:items-start udc:gap-2">
        {tone ? (
          <span
            aria-hidden
            data-testid="kanban-priority-dot"
            className={cn("udc:mt-1.5 udc:size-2 udc:shrink-0 udc:rounded-full", TONE_DOT[tone])}
          />
        ) : null}
        <h4
          data-testid="kanban-card-title"
          className="udc:min-w-0 udc:flex-1 udc:text-[13px] udc:leading-5 udc:font-medium udc:break-words"
          style={clamp(cards.title_lines)}
          title={title}
        >
          {title || <span className="udc:text-muted-foreground/60">—</span>}
        </h4>
      </div>
      {typeof body === "string" && body && cards.body_lines > 0 ? (
        <p
          data-testid="kanban-card-body"
          className="udc:text-xs udc:leading-[1.35rem] udc:text-muted-foreground"
          style={clamp(cards.body_lines)}
        >
          {body}
        </p>
      ) : null}
      {shownTags.length ? (
        <div className="udc:flex udc:flex-wrap udc:gap-1" data-testid="kanban-card-tags">
          {shownTags.map((tag) => (
            <span
              key={tag}
              className="udc:inline-flex udc:h-5 udc:items-center udc:rounded-full udc:border udc:border-border udc:bg-muted/60 udc:px-2 udc:text-[11px] udc:text-muted-foreground"
            >
              {tag}
            </span>
          ))}
          {tags.length > shownTags.length ? (
            <span className="udc:inline-flex udc:h-5 udc:items-center udc:px-1 udc:text-[11px] udc:text-muted-foreground">
              +{tags.length - shownTags.length}
            </span>
          ) : null}
        </div>
      ) : null}
      {due || people.length || footer.length ? (
        <div className="udc:flex udc:min-h-6 udc:items-center udc:gap-2 udc:text-[11px] udc:text-muted-foreground">
          {footer.length ? (
            <span
              className="udc:truncate udc:font-mono udc:tabular-nums"
              data-testid="kanban-card-footer"
            >
              {footer.map(String).join(" · ")}
            </span>
          ) : null}
          {typeof due === "string" && due ? (
            <span
              data-testid="kanban-card-due"
              data-overdue={overdue || undefined}
              title={overdue ? t("APP", "KANBAN_OVERDUE") : undefined}
              className={cn(
                "udc:inline-flex udc:items-center udc:gap-1 udc:tabular-nums",
                overdue && "udc:font-medium udc:text-sem-danger",
              )}
            >
              <CalendarDays className="udc:size-3" />
              {formatDate(due, intlLocale)}
            </span>
          ) : null}
          {people.length ? (
            <span
              className="udc:ml-auto udc:flex udc:-space-x-1"
              data-testid="kanban-card-assignees"
            >
              {people.slice(0, MAX_AVATARS).map((name) => (
                <span
                  key={name}
                  title={name}
                  className={cn(
                    "udc:grid udc:size-6 udc:place-items-center udc:rounded-full udc:text-[10px] udc:font-semibold udc:ring-2 udc:ring-surface",
                    AVATAR[avatarTone(name)],
                  )}
                >
                  {initials(name)}
                </span>
              ))}
              {people.length > MAX_AVATARS ? (
                <span
                  title={people.slice(MAX_AVATARS).join(", ")}
                  className="udc:grid udc:size-6 udc:place-items-center udc:rounded-full udc:bg-muted udc:text-[10px] udc:font-semibold udc:text-muted-foreground udc:ring-2 udc:ring-surface"
                >
                  +{people.length - MAX_AVATARS}
                </span>
              ) : null}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function cardShellClass(tone: ColumnColor | null, opts: KanbanOptions): string {
  return cn(
    "udc:block udc:w-full udc:rounded-lg udc:border udc:border-border udc:bg-surface udc:text-left udc:shadow-xs udc:shadow-black/[0.04]",
    opts.cards.show_priority_left_border && tone && cn("udc:border-l-[3px]", TONE_BORDER[tone]),
  );
}

export function KanbanCard({
  row,
  bucketId,
  opts,
  schema,
  readOnly,
  onOpen,
}: KanbanCardBodyProps & { bucketId: string; readOnly: boolean; onOpen: (row: Row) => void }) {
  const id = row.__meta.id;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: "card", bucketId },
    disabled: readOnly,
  });
  const tone = opts.card.priority_field
    ? priorityTone(row[opts.card.priority_field], schema.fields[opts.card.priority_field])
    : null;
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    listeners?.onKeyDown?.(e);
    if (e.key === "Enter" && !e.defaultPrevented) onOpen(row);
  };
  return (
    // A div, not a button: the card holds headings and paragraphs. dnd-kit's
    // `attributes` give it the sortable description.
    // biome-ignore lint/a11y/useSemanticElements: a <button> cannot hold the card's headings
    <div
      ref={setNodeRef}
      data-testid="kanban-card"
      data-card-id={id}
      data-bucket-id={bucketId}
      data-dragging={isDragging || undefined}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onKeyDown={onKeyDown}
      role="button"
      // Focusable even when read-only (no drag), so Enter still opens the card.
      tabIndex={0}
      onClick={() => onOpen(row)}
      className={cn(
        "udc-kanban-card",
        cardShellClass(tone, opts),
        "udc:outline-none udc:transition-[box-shadow,border-color] udc:hover:border-border-strong udc:hover:shadow-sm udc:focus-visible:ring-2 udc:focus-visible:ring-ring",
        readOnly
          ? "udc:cursor-pointer"
          : "udc:cursor-grab udc:touch-manipulation udc:active:cursor-grabbing",
        isDragging && "udc:opacity-40",
      )}
    >
      <KanbanCardBody row={row} opts={opts} schema={schema} />
    </div>
  );
}

/** A quick-added card until the server row arrives. */
export function PendingCard({ title }: { title: string }) {
  const { Spinner } = useUiKit();
  return (
    <div
      data-testid="kanban-pending-card"
      className="udc-kanban-card udc:flex udc:items-center udc:gap-2 udc:rounded-lg udc:border udc:border-dashed udc:border-border-strong udc:bg-surface/60 udc:px-3 udc:py-2.5 udc:text-[13px] udc:text-muted-foreground"
    >
      <Spinner className="udc:size-3" />
      <span className="udc:truncate">{title}</span>
    </div>
  );
}
