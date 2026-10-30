import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { KanbanOptions, Row, SchemaDoc } from "@jsudc/core";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { useI18n } from "../i18n/i18n.js";
import { cn } from "../lib/utils.js";
import { useUiKit } from "../ui-kit/context.js";
import { KanbanCard, PendingCard, TONE_DOT } from "./KanbanCard.js";
import type { AddWhere, Bucket } from "./model.js";

export const bucketDndId = (id: string) => `bucket:${id}`;
/** The id of a column's card list (dnd-kit's sortable container). */
export const cardsContainerId = (id: string) => `cards:${id}`;

export interface PendingAdd {
  key: number;
  bucketId: string;
  where: AddWhere;
  title: string;
}

export interface KanbanColumnProps {
  bucket: Bucket;
  /** Card ids in column order (during a drag, where the cards are drawn). */
  ids: readonly string[];
  rowById: ReadonlyMap<string, Row>;
  opts: KanbanOptions;
  schema: SchemaDoc;
  readOnly: boolean;
  pending: readonly PendingAdd[];
  onOpen: (row: Row) => void;
  onQuickAdd: (where: AddWhere, title: string) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}

/** Enter commits, Escape cancels; a blank value commits nothing. */
function useTextEntry(commit: (text: string) => void, close: () => void) {
  return (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const text = e.currentTarget.value.trim();
      if (text) commit(text);
      e.currentTarget.value = "";
    }
  };
}

function QuickAdd({ where, onAdd }: { where: AddWhere; onAdd: (title: string) => void }) {
  const { Input } = useUiKit();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const onKeyDown = useTextEntry(onAdd, () => setOpen(false));
  if (!open) {
    return (
      <button
        type="button"
        data-testid={`kanban-add-${where}`}
        onClick={() => setOpen(true)}
        className="udc:flex udc:h-8 udc:w-full udc:items-center udc:gap-1.5 udc:rounded-md udc:px-2 udc:text-xs udc:font-medium udc:text-muted-foreground udc:outline-none udc:hover:bg-hover udc:hover:text-foreground udc:focus-visible:ring-2 udc:focus-visible:ring-ring"
      >
        <Plus className="udc:size-3.5" />
        {t("APP", "KANBAN_ADD_TICKET")}
      </button>
    );
  }
  return (
    <Input
      autoFocus
      data-testid={`kanban-add-input-${where}`}
      placeholder={t("APP", "KANBAN_ADD_PLACEHOLDER")}
      onKeyDown={onKeyDown}
      onBlur={(e) => {
        if (!e.currentTarget.value.trim()) setOpen(false);
      }}
    />
  );
}

export function KanbanColumn(props: KanbanColumnProps) {
  const {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    Input,
  } = useUiKit();
  const { bucket, ids, rowById, opts, schema, readOnly } = props;
  const { t, intlLocale } = useI18n();
  const [renaming, setRenaming] = useState(false);
  const [visible, setVisible] = useState(opts.buckets.max_visible_tickets);
  const sortable = opts.board.buckets_sortable && !readOnly;
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: bucketDndId(bucket.id),
    data: { type: "bucket", bucketId: bucket.id },
    // Always a drop target for cards; draggable only when the board allows it.
    disabled: { draggable: !sortable, droppable: false },
  });
  const onRenameKey = useTextEntry(
    (name) => {
      setRenaming(false);
      if (name !== bucket.label) props.onRename(name);
    },
    () => setRenaming(false),
  );

  const shown = ids.slice(0, visible);
  const hidden = ids.length - shown.length;
  const top = props.pending.filter((p) => p.where === "top");
  const bottom = props.pending.filter((p) => p.where === "bottom");
  const showAdd = opts.buckets.show_add_ticket_button && !readOnly;

  return (
    <section
      ref={setNodeRef}
      data-testid="kanban-column"
      data-bucket-id={bucket.id}
      data-bucket-name={bucket.label}
      data-count={ids.length}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        width: opts.buckets.min_width_px,
        minWidth: opts.buckets.min_width_px,
      }}
      className={cn(
        "udc-kanban-column",
        "udc:flex udc:max-h-full udc:shrink-0 udc:flex-col udc:rounded-xl udc:border udc:border-border/80 udc:bg-muted/45 udc:dark:bg-muted/30",
        isDragging && "udc:opacity-50",
      )}
    >
      <header
        ref={setActivatorNodeRef}
        {...(sortable ? { ...attributes, ...listeners } : {})}
        data-testid="kanban-column-header"
        className={cn(
          "udc:flex udc:h-11 udc:shrink-0 udc:items-center udc:gap-2 udc:rounded-t-xl udc:pr-1.5 udc:pl-3 udc:outline-none udc:focus-visible:ring-2 udc:focus-visible:ring-ring",
          sortable && "udc:cursor-grab udc:active:cursor-grabbing",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "udc:size-2.5 udc:shrink-0 udc:rounded-full",
            TONE_DOT[bucket.color ?? "default"],
          )}
        />
        {renaming ? (
          <Input
            autoFocus
            data-testid="kanban-rename-input"
            defaultValue={bucket.label}
            className="udc:h-7"
            onKeyDown={onRenameKey}
            onPointerDown={(e) => e.stopPropagation()}
            onBlur={() => setRenaming(false)}
          />
        ) : (
          <h3
            data-testid="kanban-column-name"
            className="udc:min-w-0 udc:truncate udc:text-[13px] udc:font-semibold udc:tracking-tight"
            title={bucket.label}
            onDoubleClick={readOnly ? undefined : () => setRenaming(true)}
          >
            {bucket.label}
          </h3>
        )}
        {opts.buckets.show_count && !renaming ? (
          <span
            data-testid="kanban-column-count"
            className="udc:rounded-full udc:bg-surface udc:px-1.5 udc:text-[11px] udc:font-medium udc:text-muted-foreground udc:tabular-nums udc:ring-1 udc:ring-border"
          >
            {new Intl.NumberFormat(intlLocale).format(ids.length)}
          </span>
        ) : null}
        <span className="udc:flex-1" />
        {readOnly ? null : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                data-testid="kanban-column-menu"
                aria-label={t("APP", "KANBAN_BUCKET_MENU", { name: bucket.label })}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="udc:size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem data-testid="kanban-rename" onSelect={() => setRenaming(true)}>
                <Pencil />
                {t("APP", "KANBAN_RENAME")}
              </DropdownMenuItem>
              <DropdownMenuItem
                tone="danger"
                data-testid="kanban-delete-bucket"
                disabled={ids.length > 0}
                onSelect={props.onDelete}
              >
                <Trash2 />
                {ids.length > 0 ? t("APP", "KANBAN_DELETE_NOT_EMPTY") : t("APP", "KANBAN_DELETE")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      {showAdd ? (
        <div className="udc:px-2 udc:pb-1">
          <QuickAdd where="top" onAdd={(title) => props.onQuickAdd("top", title)} />
        </div>
      ) : null}

      <SortableContext
        id={cardsContainerId(bucket.id)}
        items={shown as string[]}
        strategy={verticalListSortingStrategy}
      >
        <div
          data-testid="kanban-column-cards"
          className="udc-scroll-thin udc:flex udc:min-h-16 udc:flex-1 udc:flex-col udc:gap-2 udc:overflow-y-auto udc:px-2 udc:pt-0.5 udc:pb-2"
        >
          {top.map((p) => (
            <PendingCard key={p.key} title={p.title} />
          ))}
          {shown.map((id) => {
            const row = rowById.get(id);
            return row ? (
              <KanbanCard
                key={id}
                row={row}
                bucketId={bucket.id}
                opts={opts}
                schema={schema}
                readOnly={readOnly}
                onOpen={props.onOpen}
              />
            ) : null;
          })}
          {hidden > 0 ? (
            <Button
              size="sm"
              variant="ghost"
              data-testid="kanban-show-more"
              onClick={() => setVisible((v) => v + opts.buckets.max_visible_tickets)}
            >
              {t("APP", "KANBAN_SHOW_MORE", {
                n: new Intl.NumberFormat(intlLocale).format(hidden),
              })}
            </Button>
          ) : null}
          {ids.length === 0 && props.pending.length === 0 ? (
            <div className="udc:grid udc:h-16 udc:place-items-center udc:rounded-lg udc:border udc:border-dashed udc:border-border udc:text-xs udc:text-muted-foreground/80">
              {t("APP", "KANBAN_EMPTY_COLUMN")}
            </div>
          ) : null}
          {bottom.map((p) => (
            <PendingCard key={p.key} title={p.title} />
          ))}
        </div>
      </SortableContext>

      {showAdd ? (
        <div className="udc:border-t udc:border-border/60 udc:px-2 udc:py-1.5">
          <QuickAdd where="bottom" onAdd={(title) => props.onQuickAdd("bottom", title)} />
        </div>
      ) : null}
    </section>
  );
}

/** The `+ Add bucket` slot after the last column. */
export function AddBucketSlot({ onAdd }: { onAdd: (name: string) => void }) {
  const { Input } = useUiKit();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const onKeyDown = useTextEntry(
    (name) => {
      onAdd(name);
      setOpen(false);
    },
    () => setOpen(false),
  );
  return (
    <div className="udc:w-64 udc:shrink-0">
      {open ? (
        <Input
          autoFocus
          data-testid="kanban-add-bucket-input"
          placeholder={t("APP", "KANBAN_ADD_BUCKET_PLACEHOLDER")}
          onKeyDown={onKeyDown}
          onBlur={() => setOpen(false)}
        />
      ) : (
        <button
          type="button"
          data-testid="kanban-add-bucket"
          onClick={() => setOpen(true)}
          className="udc:flex udc:h-11 udc:w-full udc:items-center udc:gap-1.5 udc:rounded-xl udc:border udc:border-dashed udc:border-border-strong/70 udc:px-3 udc:text-[13px] udc:font-medium udc:text-muted-foreground udc:outline-none udc:hover:bg-hover udc:hover:text-foreground udc:focus-visible:ring-2 udc:focus-visible:ring-ring"
        >
          <Plus className="udc:size-4" />
          {t("APP", "KANBAN_ADD_BUCKET")}
        </button>
      )}
    </div>
  );
}
