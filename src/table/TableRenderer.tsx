import {
  type ColumnConfig,
  type DescribeResponse,
  type FieldDef,
  isUdcError,
  isVersionConflict,
  type Row,
  rowLinkCondition,
  type SortKey,
  type UdcError,
} from "@jsudc/core";
import {
  type Column,
  type ColumnDef,
  getCoreRowModel,
  type Row as TableRow,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, Plus } from "lucide-react";
import {
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  RowActionsControls,
  rowActionsColumnWidth,
  rowMenuHandlers,
  useRowMenu,
} from "../actions/RowActionsMenu.js";
import type { RowActions } from "../actions/row.js";
import { useCellRegistry } from "../cells/registry.js";
import { FolderEntry } from "../data-view/FolderEntry.js";
import { columnSortable, sourceSortable } from "../data-view/liveView.js";
import { tableSection, useI18n } from "../i18n/i18n.js";
import { cn } from "../lib/utils.js";
import { UdcLookupBatch, useLookupBatch } from "../lookup/batch.js";
import { filterHref, followLink, useUdcLinks } from "../lookup/links.js";
import type { FolderNav } from "../renderers/types.js";
import { type RowActivationProps, useRowActivation } from "../rows/useRowActivation.js";
import type { RowSelection } from "../rows/useRowSelection.js";
import { ColumnHeaderMenu } from "../schema-editor/ColumnHeaderMenu.js";
import type { SchemaAction } from "../schema-editor/fieldForm.js";
import type { UdcCollectionResult } from "../udc/hooks.js";
import { useUdcMutate } from "../udc/hooks.js";
import type { PagingMode } from "../udc/keys.js";
import { useUiKit } from "../ui-kit/context.js";
import {
  CellEditor,
  type CommitReason,
  type EditorRaw,
  editorKind,
  fromEditorValue,
  sameValue,
} from "./CellEditor.js";
import { CellValue } from "./cells.js";
import { Pager } from "./Pager.js";
import { SelectCheckbox } from "./SelectCheckbox.js";
import { EmptyState, ErrorState } from "./states.js";
import { BG_COLOR, resolveRowColor, TEXT_COLOR } from "./style.js";
import { useInfiniteSentinel } from "./useInfiniteSentinel.js";
import {
  bodySlices,
  resolveVirtualization,
  type TableVirtualizeProp,
  useRowWindow,
  virtualizationApplies,
} from "./useRowWindow.js";

interface ColMeta {
  config: ColumnConfig;
  def: FieldDef | undefined;
}

const meta = (c: Column<Row, unknown>) => c.columnDef.meta as ColMeta;

const SKELETON_ROWS = 12;
const DEFAULT_ROW_HEIGHT = 40;
/** The trailing `+` header cell that adds a column at the end. */
const ADD_COLUMN_WIDTH = 44;
/** The checkbox column pinned at the start while the view selects. */
const SELECT_COLUMN_WIDTH = 40;

/** The message a `validation_error` carries for one field, else its overall message. */
export function fieldProblem(err: UdcError, field: string): string {
  const problems = err.details?.problems;
  if (Array.isArray(problems)) {
    const hit = problems.find(
      (p): p is { field: string; message: string } =>
        !!p && typeof p === "object" && (p as { field?: unknown }).field === field,
    );
    if (hit) return hit.message;
  }
  return err.message;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface TableRendererProps extends RowActivationProps {
  collection: string;
  describe: DescribeResponse;
  data: UdcCollectionResult;
  mode: PagingMode;
  page: number;
  limit: number;
  onPage: (page: number) => void;
  sort: SortKey[];
  onSort: (field: string, multi: boolean) => void;
  filtered: boolean;
  onClearFilters: () => void;
  /** Changes whenever the rows are a different query; scrolls back to the top. */
  resetKey: string;
  /** Set when the schema may be edited: shows the column menus and the trailing `+`. */
  onSchemaAction?: ((a: SchemaAction) => void) | undefined;
  /** A folder listing: the label column opens folders and previews files. */
  folder?: FolderNav | undefined;
  /** Row selection (0.5.0): a checkbox column pinned at the start; Space toggles the active row. */
  selection?: RowSelection | undefined;
  /** Row actions (0.5.0): a trailing column pinned at the end, inline buttons or a "more" menu. */
  rowActions?: RowActions | undefined;
  /**
   * Long lists (0.5.0): infinite mode mounts only the rows near the viewport. Left out, or
   * `{ enabled: "auto" }`: once more than `threshold` (200) rows are loaded. `true` / `false`
   * force it on or off. Pages mode is never windowed. See README "Long lists".
   */
  virtualize?: TableVirtualizeProp | undefined;
}

type EditTarget = { rowId: string; colId: string };

export function TableRenderer(props: TableRendererProps) {
  const { Skeleton, Spinner, useToast } = useUiKit();
  const { collection, describe, data, mode, sort } = props;
  const { view, schema, capabilities } = describe;
  const { t, locale, intlLocale } = useI18n();
  const { toast } = useToast();
  const mutate = useUdcMutate(collection);
  const section = tableSection(collection);
  const links = useUdcLinks();
  const cells = useCellRegistry();
  const rowLink = view.row_link;
  // The fields the source sorts on (describe.sortable, 0.5.2); the others get a plain header.
  const sourceSorts = useMemo(() => sourceSortable(describe), [describe]);
  // One lookup batch per lookup column for the rows on screen, not one call per cell.
  const lookupFields = useMemo(() => view.columns.map((c) => c.field), [view.columns]);
  const lookups = useLookupBatch(data.rows, schema, lookupFields);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLTableSectionElement>(null);
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const [edit, setEdit] = useState<EditTarget | null>(null);
  const [editError, setEditError] = useState<{ message: string; seq: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const columns = useMemo<ColumnDef<Row>[]>(
    () =>
      view.columns
        .filter((c) => schema.fields[c.field]?.deleted !== true)
        .map((c) => ({
          id: c.id ?? c.field,
          accessorFn: (r: Row) => r[c.field],
          size: c.width ?? view.default_column_width,
          meta: { config: c, def: schema.fields[c.field] } satisfies ColMeta,
        })),
    [view.columns, view.default_column_width, schema.fields],
  );

  const columnPinning = useMemo(
    () => ({
      left: view.columns.filter((c) => c.pin === "left").map((c) => c.id ?? c.field),
      right: view.columns.filter((c) => c.pin === "right").map((c) => c.id ?? c.field),
    }),
    [view.columns],
  );

  const table = useReactTable({
    data: data.rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.__meta.id,
    manualSorting: true,
    manualPagination: true,
    state: {
      columnPinning,
      sorting: sort.map((k) => ({ id: k.field, desc: k.dir === "desc" })),
    },
  });

  const selection = props.selection;
  const selectWidth = selection ? SELECT_COLUMN_WIDTH : 0;
  // Row actions (0.5.0): a column pinned at the end, after any column pinned right.
  const rowActions = props.rowActions;
  const rowMenu = useRowMenu();
  const actionsWidth = rowActions ? rowActionsColumnWidth(rowActions) : 0;
  const left = table.getLeftLeafColumns();
  const center = table.getCenterLeafColumns();
  const right = table.getRightLeafColumns();
  const ordered = [...left, ...center, ...right];
  const schemaEdit = capabilities.schema_edit && props.onSchemaAction !== undefined;
  const totalWidth =
    ordered.reduce((sum, c) => sum + c.getSize(), 0) +
    (schemaEdit ? ADD_COLUMN_WIDTH : 0) +
    selectWidth +
    actionsWidth;
  const rowHeight = view.row_height ?? DEFAULT_ROW_HEIGHT;

  // Long lists (0.5.0): infinite mode past the threshold mounts the rows near the viewport.
  const showSkeleton = data.isLoading && data.rows.length === 0;
  const virtual = !showSkeleton && virtualizationApplies(props.virtualize, mode, data.rows.length);
  const virtualOpts = resolveVirtualization(props.virtualize);
  // The height a row really takes (a border, a tall custom cell); the spacers use it.
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const windowRowHeight = virtual && measuredHeight ? measuredHeight : rowHeight;
  const win = useRowWindow({
    on: virtual,
    count: data.rows.length,
    rowHeight: windowRowHeight,
    overscan: virtualOpts.overscan,
    scrollRef,
    headerRef,
  });
  useLayoutEffect(() => {
    if (!virtual) return;
    const tr = bodyRef.current?.querySelector<HTMLElement>("tr[data-row-id]");
    const h = tr?.getBoundingClientRect().height ?? 0;
    if (h > 0 && Math.abs(h - (measuredHeight ?? rowHeight)) > 0.5) setMeasuredHeight(h);
  });
  // The row holding the focus is kept mounted when it scrolls out of the window.
  const [focusedRowId, setFocusedRowId] = useState<string | null>(null);

  const canEdit = (c: Column<Row, unknown>) =>
    capabilities.mutate && meta(c).config.editable === true && meta(c).def !== undefined;
  const editableIds = ordered.filter(canEdit).map((c) => c.id);

  // Pinned-edge shadows appear only once there is something scrolled under them.
  const measureEdges = () => {
    const el = scrollRef.current;
    if (!el) return;
    const next = {
      left: el.scrollLeft > 0,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    };
    setEdges((prev) => (prev.left === next.left && prev.right === next.right ? prev : next));
  };
  useEffect(() => {
    measureEdges();
    window.addEventListener("resize", measureEdges);
    return () => window.removeEventListener("resize", measureEdges);
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: `resetKey` is the trigger
  useEffect(() => {
    if (props.resetKey && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
      win.onScroll();
    }
  }, [props.resetKey]);

  // Infinite mode: the sentinel under the last row asks for the next page.
  const { hasNextPage, isFetchingNextPage } = data;
  useInfiniteSentinel(mode === "infinite", scrollRef, sentinelRef, data);

  // Row activation and the keys (off unless the host passed one of its props).
  const activation = useRowActivation({
    rows: data.rows,
    activeRowId: props.activeRowId,
    onRowActivate: props.onRowActivate,
    onActiveRowChange: props.onActiveRowChange,
    hasNextPage: mode === "infinite" && hasNextPage,
    isFetchingNextPage,
    fetchNextPage: data.fetchNextPage,
    ...(virtual ? { reveal: (_row: Row, index: number) => win.scrollToIndex(index) } : {}),
    ...(selection
      ? {
          isSelected: selection.isSelected,
          onToggleSelect: (row: Row, range: boolean) => selection.toggle(row.__meta.id, { range }),
        }
      : {}),
  });

  const rowLinkHref = (row: Row) =>
    rowLink ? filterHref(links, rowLink.collection, rowLinkCondition(row, rowLink)) : "";
  /**
   * A click on a row of a view with `row_link` opens the linked collection;
   * Cmd / Ctrl / the middle button opens it in a new tab. A click in an
   * editable cell, on a link or a control, or while a cell is edited, stays
   * where it is (double-click still edits).
   */
  const onRowLinkClick = (e: MouseEvent<HTMLElement>, row: Row) => {
    if (!rowLink || edit || (e.type === "auxclick" && e.button !== 1)) return;
    const target = e.target as HTMLElement;
    if (target.closest("a,button,input,select,textarea,label,[data-editable]")) return;
    followLink(e, rowLinkHref(row), links);
  };
  /**
   * With `onRowActivate` a plain click activates the row; Cmd / Ctrl-click and
   * the middle button (`onAuxClick`) still follow a `row_link`. Without it a
   * `row_link` view navigates as before.
   */
  const onRowClick = (e: MouseEvent<HTMLElement>, row: Row) => {
    if (rowLink && (!props.onRowActivate || e.metaKey || e.ctrlKey || e.shiftKey)) {
      onRowLinkClick(e, row);
      return;
    }
    activation.handleClick(e, row);
  };

  const focusCell = (target: EditTarget) =>
    requestAnimationFrame(() => {
      const sel = `[data-cell="${CSS.escape(`${target.rowId}:${target.colId}`)}"]`;
      scrollRef.current?.querySelector<HTMLElement>(sel)?.focus();
    });

  const startEdit = (target: EditTarget) => {
    setEditError(null);
    setEdit(target);
  };

  const commit = async (
    row: Row,
    col: Column<Row, unknown>,
    raw: EditorRaw,
    reason: CommitReason,
  ) => {
    const { config, def } = meta(col);
    const target = { rowId: row.__meta.id, colId: col.id };
    const parsed = fromEditorValue(raw, editorKind(def), def);
    if ("error" in parsed) {
      setEditError((e) => ({ message: capitalize(parsed.error), seq: (e?.seq ?? 0) + 1 }));
      return;
    }
    const finish = () => {
      setEditError(null);
      if (reason === "tab" || reason === "shift-tab") {
        const i = editableIds.indexOf(col.id) + (reason === "tab" ? 1 : -1);
        const next = editableIds[i];
        if (next) return startEdit({ rowId: row.__meta.id, colId: next });
      }
      setEdit(null);
      if (reason !== "blur") focusCell(target);
    };

    if (sameValue(parsed.value, row[config.field])) return finish();

    setSaving(true);
    try {
      await mutate.mutateAsync({
        op: "update",
        id: row.__meta.id,
        row: { [config.field]: parsed.value },
        expected_version: row.__meta.version,
      });
      setSaving(false);
      finish();
    } catch (err) {
      setSaving(false);
      if (isUdcError(err) && err.code === "validation_error") {
        setEditError((e) => ({
          message: capitalize(fieldProblem(err, config.field)),
          seq: (e?.seq ?? 0) + 1,
        }));
        return;
      }
      setEdit(null);
      setEditError(null);
      if (isVersionConflict(err)) {
        toast({
          variant: "warning",
          title: t("APP", "CONFLICT_TITLE"),
          description: t("APP", "CONFLICT_BODY"),
        });
      } else {
        toast({
          variant: "danger",
          title: t("APP", "SAVE_FAILED"),
          description: err instanceof Error ? err.message : String(err),
        });
      }
    }
  };

  const pinStyle = (c: Column<Row, unknown>): CSSProperties => {
    const pin = c.getIsPinned();
    const width = c.getSize();
    if (pin === "left") return { width, left: c.getStart("left") + selectWidth };
    if (pin === "right") return { width, right: c.getAfter("right") + actionsWidth };
    return { width };
  };

  const pinClass = (c: Column<Row, unknown>) => {
    const pin = c.getIsPinned();
    if (!pin) return "";
    const edge = pin === "left" ? c.getIsLastColumn("left") : c.getIsFirstColumn("right");
    return cn(
      "udc:sticky udc:z-[5]",
      edge &&
        pin === "left" &&
        "udc:after:pointer-events-none udc:after:absolute udc:after:inset-y-0 udc:after:-right-3 udc:after:w-3 udc:after:bg-gradient-to-r udc:after:from-[var(--shadow-pin)] udc:after:to-transparent udc:after:opacity-0 udc:after:transition-opacity",
      edge && pin === "left" && edges.left && "udc:after:opacity-100",
      edge &&
        pin === "right" &&
        "udc:before:pointer-events-none udc:before:absolute udc:before:inset-y-0 udc:before:-left-3 udc:before:w-3 udc:before:bg-gradient-to-l udc:before:from-[var(--shadow-pin)] udc:before:to-transparent udc:before:opacity-0 udc:before:transition-opacity",
      edge && pin === "right" && edges.right && "udc:before:opacity-100",
    );
  };

  const alignClass = (c: Column<Row, unknown>) => {
    const a = meta(c).config.align;
    return a === "right"
      ? "udc:text-right udc:justify-end"
      : a === "center"
        ? "udc:text-center udc:justify-center"
        : "";
  };

  const showError = data.error !== null && data.rows.length === 0;
  const showEmpty = !showSkeleton && !showError && data.rows.length === 0;
  const total = data.total ?? data.rows.length;

  const header = (c: Column<Row, unknown>) => {
    const { config, def } = meta(c);
    const label = t(section, config.field);
    const key = sort.find((k) => k.field === config.field);
    const sortable = columnSortable(config, def, sourceSorts);
    const dir = key ? (key.dir ?? "asc") : null;
    const Icon = dir === "asc" ? ArrowUp : dir === "desc" ? ArrowDown : ChevronsUpDown;
    const menu = schemaEdit && def !== undefined && props.onSchemaAction;
    const text = (
      <span className="udc:flex udc:min-w-0 udc:items-baseline udc:gap-0.5">
        <span className="udc:truncate">{label}</span>
        {def?.required ? (
          // The star is CSS content, so the header's text stays the bare label.
          <span
            data-testid="required-marker"
            title={t("APP", "FORM_REQUIRED")}
            className="udc:text-sem-danger udc:after:content-['*']"
          />
        ) : null}
      </span>
    );
    return (
      <th
        key={c.id}
        scope="col"
        data-testid={`th-${config.field}`}
        data-required={def?.required || undefined}
        aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : undefined}
        style={pinStyle(c)}
        className={cn(
          "udc:group/th udc:relative udc:h-9 udc:border-b udc:border-border udc:bg-muted udc:p-0 udc:text-left udc:text-xs udc:font-medium udc:text-muted-foreground",
          pinClass(c),
          c.getIsPinned() ? "udc:z-[15]" : "",
        )}
      >
        {sortable ? (
          <button
            type="button"
            data-testid={`sort-${config.field}`}
            onClick={(e) => props.onSort(config.field, e.shiftKey)}
            title={dir ? t("APP", dir === "asc" ? "SORT_ASC" : "SORT_DESC") : undefined}
            className={cn(
              "udc:flex udc:h-full udc:w-full udc:items-center udc:gap-1 udc:px-3 udc:outline-none udc:transition-colors udc:hover:text-foreground udc:focus-visible:ring-2 udc:focus-visible:ring-ring udc:focus-visible:ring-inset",
              alignClass(c),
              dir && "udc:text-foreground",
            )}
          >
            {text}
            <Icon
              className={cn(
                "udc:size-3.5 udc:shrink-0 udc:transition-opacity",
                dir
                  ? "udc:text-primary udc:opacity-100"
                  : "udc:opacity-0 udc:group-hover/th:opacity-60",
              )}
            />
          </button>
        ) : (
          <div className={cn("udc:flex udc:h-full udc:items-center udc:px-3", alignClass(c))}>
            {text}
          </div>
        )}
        {menu ? (
          <ColumnHeaderMenu
            field={config.field}
            label={label}
            onAction={menu}
            className="udc:absolute udc:top-1/2 udc:right-1.5 udc:-translate-y-1/2 udc:bg-muted udc:shadow-[-10px_0_8px_-2px_var(--muted)]"
          />
        ) : null}
      </th>
    );
  };

  const addColumnHeader = schemaEdit ? (
    <th
      key="__add"
      scope="col"
      className="udc:h-9 udc:border-r udc:border-b udc:border-border udc:bg-muted udc:p-0"
      style={{ width: ADD_COLUMN_WIDTH }}
    >
      <button
        type="button"
        data-testid="col-add-end"
        title={t("APP", "COL_ADD")}
        aria-label={t("APP", "COL_ADD")}
        onClick={() => props.onSchemaAction?.({ kind: "add", position: { where: "end" } })}
        className="udc:grid udc:h-full udc:w-full udc:place-items-center udc:text-muted-foreground udc:outline-none udc:transition-colors udc:hover:bg-hover udc:hover:text-primary udc:focus-visible:ring-2 udc:focus-visible:ring-ring udc:focus-visible:ring-inset"
      >
        <Plus className="udc:size-4" />
      </button>
    </th>
  ) : null;
  const addColumnCell = (key: string, className: string) =>
    schemaEdit ? (
      <td
        key={key}
        aria-hidden
        className={cn("udc:border-r udc:border-b udc:border-border udc:p-0", className)}
      />
    ) : null;

  const filler = (key: string, className?: string) => (
    <td key={key} aria-hidden className={cn("udc:p-0", className)} />
  );

  // The checkbox column: pinned at the start, before any column pinned left.
  const selectClass = cn(
    "udc:sticky udc:left-0 udc:z-[5] udc:border-b udc:border-border udc:p-0",
    left.length === 0 &&
      "udc:after:pointer-events-none udc:after:absolute udc:after:inset-y-0 udc:after:-right-3 udc:after:w-3 udc:after:bg-gradient-to-r udc:after:from-[var(--shadow-pin)] udc:after:to-transparent udc:after:opacity-0 udc:after:transition-opacity",
    left.length === 0 && edges.left && "udc:after:opacity-100",
  );
  const pageState = selection?.pageState ?? "none";
  const selectHeader = selection ? (
    <th
      key="__select"
      scope="col"
      data-testid="th-select"
      style={{ width: SELECT_COLUMN_WIDTH }}
      className={cn(selectClass, "udc:z-[15] udc:h-9 udc:bg-muted")}
    >
      <SelectCheckbox
        data-testid="select-page"
        label={t("APP", "SELECT_PAGE")}
        checked={pageState === "all"}
        indeterminate={pageState === "some"}
        disabled={data.rows.length === 0}
        onToggle={() => selection.setPage(pageState !== "all")}
      />
    </th>
  ) : null;
  const selectCell = (row: Row, className: string) =>
    selection ? (
      <td
        key="__select"
        data-testid="cell-select"
        style={{ width: SELECT_COLUMN_WIDTH }}
        className={cn(selectClass, className)}
      >
        <SelectCheckbox
          data-testid="select-row"
          label={t("APP", "SELECT_ROW")}
          checked={selection.isSelected(row.__meta.id)}
          onToggle={(range) => selection.toggle(row.__meta.id, { range })}
        />
      </td>
    ) : null;

  // The row actions column: pinned at the end, its shadow when rows scroll under it.
  const actionsClass = cn(
    "udc:sticky udc:right-0 udc:z-[5] udc:border-b udc:border-border udc:p-0",
    right.length === 0 &&
      "udc:before:pointer-events-none udc:before:absolute udc:before:inset-y-0 udc:before:-left-3 udc:before:w-3 udc:before:bg-gradient-to-l udc:before:from-[var(--shadow-pin)] udc:before:to-transparent udc:before:opacity-0 udc:before:transition-opacity",
    right.length === 0 && edges.right && "udc:before:opacity-100",
  );
  const actionsHeader = rowActions ? (
    <th
      key="__actions"
      scope="col"
      data-testid="th-actions"
      style={{ width: actionsWidth }}
      className={cn(actionsClass, "udc:z-[15] udc:h-9 udc:bg-muted")}
    >
      <span className="udc:sr-only">{t("APP", "ROW_ACTIONS")}</span>
    </th>
  ) : null;
  const actionsCell = (row: Row, className: string) =>
    rowActions ? (
      <td
        key="__actions"
        data-testid="cell-actions"
        style={{ width: actionsWidth }}
        className={cn(actionsClass, "udc:px-1.5", className)}
      >
        <RowActionsControls row={row} rowActions={rowActions} menu={rowMenu} />
      </td>
    ) : null;

  const renderRow = (r: TableRow<Row>, index: number): ReactNode => {
    const row = r.original;
    const tone = resolveRowColor(row, view.row_color);
    const active = activation.activeRowId === row.__meta.id;
    const checked = selection?.isSelected(row.__meta.id) === true;
    const rowProps = activation.rowProps(row);
    const menuKeys = rowMenuHandlers(rowActions, rowMenu, row, {
      contextMenu: rowActions?.display === "menu",
    });
    const cell = (c: Column<Row, unknown>) => {
      const { config, def } = meta(c);
      const editable = canEdit(c);
      const id = `${row.__meta.id}:${c.id}`;
      const editing = edit?.rowId === row.__meta.id && edit.colId === c.id;
      const color = config.color ?? tone?.color;
      const bg = config.bg ?? tone?.bg;
      return (
        <td
          key={c.id}
          data-cell={id}
          data-testid={`cell-${config.field}`}
          data-editable={editable || undefined}
          tabIndex={editable ? 0 : undefined}
          title={editable && !editing ? t("APP", "EDIT_HINT") : undefined}
          onDoubleClick={
            editable ? () => startEdit({ rowId: row.__meta.id, colId: c.id }) : undefined
          }
          onKeyDown={
            editable && !editing
              ? (e) => {
                  if (e.key === "Enter" || e.key === "F2") {
                    e.preventDefault();
                    startEdit({ rowId: row.__meta.id, colId: c.id });
                  }
                }
              : undefined
          }
          style={pinStyle(c)}
          className={cn(
            "udc-cell",
            "udc:relative udc:border-b udc:border-border udc:px-3 udc:align-middle udc:outline-none",
            active || checked
              ? "udc:bg-selected"
              : bg && bg !== "default"
                ? BG_COLOR[bg]
                : "udc:bg-surface udc:group-hover/row:bg-hover",
            color ? TEXT_COLOR[color] : "",
            color === "info" || color === "accent" ? "udc:font-medium" : "",
            editable &&
              "udc:cursor-text udc:focus-visible:ring-2 udc:focus-visible:ring-ring udc:focus-visible:ring-inset udc:hover:shadow-[inset_0_0_0_1px_var(--border-strong)]",
            pinClass(c),
            // Above the next rows, so the validation message under the cell shows.
            editing && "udc:z-[25]",
          )}
        >
          <div className={cn("udc:flex udc:min-w-0 udc:items-center", alignClass(c))}>
            {props.folder && config.field === props.folder.options.label_field ? (
              <FolderEntry row={row} nav={props.folder}>
                <CellValue
                  value={row[config.field]}
                  column={config}
                  def={def}
                  locale={locale}
                  intlLocale={intlLocale}
                  cells={cells}
                  row={row}
                  collection={collection}
                />
              </FolderEntry>
            ) : (
              <CellValue
                value={row[config.field]}
                column={config}
                def={def}
                locale={locale}
                intlLocale={intlLocale}
                editable={editable}
                cells={cells}
                row={row}
                collection={collection}
              />
            )}
          </div>
          {editing ? (
            <CellEditor
              def={def}
              initial={row[config.field]}
              saving={saving}
              error={editError?.message ?? null}
              errorSeq={editError?.seq ?? 0}
              align={config.align}
              onCommit={(raw, reason) => void commit(row, c, raw, reason)}
              onCancel={() => {
                setEdit(null);
                setEditError(null);
                focusCell({ rowId: row.__meta.id, colId: c.id });
              }}
            />
          ) : null}
        </td>
      );
    };
    return (
      <tr
        key={r.id}
        data-testid="row"
        data-row-id={row.__meta.id}
        aria-rowindex={virtual ? index + 1 : undefined}
        data-row-link={rowLink ? rowLinkHref(row) : undefined}
        data-selected={checked ? "true" : undefined}
        {...rowProps}
        {...(rowActions
          ? {
              onKeyDown: (e: KeyboardEvent<HTMLTableRowElement>) => {
                if (!menuKeys.keyDown(e)) rowProps.onKeyDown?.(e);
              },
              onContextMenu: menuKeys.contextMenu,
            }
          : {})}
        className={cn(
          "udc-row udc:group/row",
          (rowLink || activation.enabled) && "udc:cursor-pointer",
          activation.enabled &&
            "udc:outline-none udc:focus-visible:outline-2 udc:focus-visible:-outline-offset-2 udc:focus-visible:outline-ring",
        )}
        style={{ height: rowHeight }}
        onClick={rowLink || activation.enabled ? (e) => onRowClick(e, row) : undefined}
        onAuxClick={rowLink ? (e) => onRowLinkClick(e, row) : undefined}
      >
        {selectCell(
          row,
          active || checked ? "udc:bg-selected" : "udc:bg-surface udc:group-hover/row:bg-hover",
        )}
        {[...left, ...center].map(cell)}
        {addColumnCell(
          "a",
          active || checked ? "udc:bg-selected" : "udc:bg-surface udc:group-hover/row:bg-hover",
        )}
        {filler(
          "f",
          active || checked
            ? "udc:border-b udc:border-border udc:bg-selected"
            : "udc:border-b udc:border-border udc:bg-surface udc:group-hover/row:bg-hover",
        )}
        {right.map(cell)}
        {actionsCell(
          row,
          active || checked ? "udc:bg-selected" : "udc:bg-surface udc:group-hover/row:bg-hover",
        )}
      </tr>
    );
  };

  // Long lists: the mounted rows (the window, and the rows kept mounted wherever they are:
  // an open editor, an open row menu, the focus, the active row and the tab stop) between
  // spacers that stand for the rest. Off, every row as before.
  const modelRows = table.getRowModel().rows;
  const columnCount =
    (selection ? 1 : 0) +
    left.length +
    center.length +
    (schemaEdit ? 1 : 0) +
    1 +
    right.length +
    (rowActions ? 1 : 0);
  let bodyRows: ReactNode;
  if (!virtual) {
    bodyRows = modelRows.map((r, i) => renderRow(r, i));
  } else {
    const indexOf = new Map<string, number>();
    modelRows.forEach((r, i) => {
      indexOf.set(r.id, i);
    });
    const pinned = [
      edit?.rowId,
      rowMenu.openId,
      focusedRowId,
      activation.activeRowId,
      activation.tabStopId,
    ]
      .map((id) => (id == null ? -1 : (indexOf.get(id) ?? -1)))
      .filter((i) => i >= 0);
    // One flat list, so a row keeps its element (and an open editor) as spacers come and go.
    bodyRows = bodySlices(modelRows.length, win.range, pinned).flatMap((slice) =>
      slice.kind === "gap" ? (
        <tr
          key={`gap-${slice.from}`}
          aria-hidden
          data-testid="row-spacer"
          style={{ height: slice.rows * windowRowHeight }}
        >
          <td colSpan={columnCount} className="udc:p-0" />
        </tr>
      ) : (
        modelRows.slice(slice.from, slice.to).map((r, i) => renderRow(r, slice.from + i))
      ),
    );
  }

  return (
    <div className="udc:flex udc:min-h-0 udc:flex-1 udc:flex-col">
      <div
        ref={scrollRef}
        onScroll={() => {
          measureEdges();
          win.onScroll();
        }}
        data-testid="table-scroll"
        className="udc-scroll-thin udc:relative udc:min-h-0 udc:flex-1 udc:overflow-auto"
      >
        {data.isFetching && !data.isLoading && !isFetchingNextPage ? (
          <div className="udc:pointer-events-none udc:sticky udc:top-0 udc:left-0 udc:z-30 udc:h-0">
            <div className="udc:h-0.5 udc:w-full udc:overflow-hidden udc:bg-primary/15">
              <div className="udc:h-full udc:w-1/3 udc:animate-[shimmer_1s_linear_infinite] udc:bg-primary/70 udc:[background-size:200%_100%]" />
            </div>
          </div>
        ) : null}
        {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-multiselectable is set only with role="grid" */}
        <table
          data-testid="udc-table"
          aria-busy={data.isFetching}
          aria-rowcount={virtual ? data.rows.length : total}
          role={activation.enabled ? "grid" : undefined}
          aria-multiselectable={activation.enabled && selection ? true : undefined}
          className="udc-table udc:border-separate udc:border-spacing-0 udc:text-[13px]"
          style={{ width: totalWidth, minWidth: "100%", tableLayout: "fixed" }}
        >
          <colgroup>
            {selection ? <col style={{ width: SELECT_COLUMN_WIDTH }} /> : null}
            {[...left, ...center].map((c) => (
              <col key={c.id} style={{ width: c.getSize() }} />
            ))}
            {schemaEdit ? <col style={{ width: ADD_COLUMN_WIDTH }} /> : null}
            <col />
            {right.map((c) => (
              <col key={c.id} style={{ width: c.getSize() }} />
            ))}
            {rowActions ? <col style={{ width: actionsWidth }} /> : null}
          </colgroup>
          <thead ref={headerRef} className="udc:sticky udc:top-0 udc:z-30">
            <tr>
              {selectHeader}
              {[...left, ...center].map(header)}
              {addColumnHeader}
              <th aria-hidden className="udc:border-b udc:border-border udc:bg-muted udc:p-0" />
              {right.map(header)}
              {actionsHeader}
            </tr>
          </thead>
          <UdcLookupBatch value={lookups}>
            <tbody
              ref={bodyRef}
              {...(virtual
                ? {
                    onFocus: (e: FocusEvent<HTMLTableSectionElement>) => {
                      const tr = (e.target as HTMLElement).closest?.("tr[data-row-id]");
                      setFocusedRowId(tr?.getAttribute("data-row-id") ?? null);
                    },
                    onBlur: (e: FocusEvent<HTMLTableSectionElement>) => {
                      const next = e.relatedTarget as Node | null;
                      if (!next || !e.currentTarget.contains(next)) setFocusedRowId(null);
                    },
                  }
                : {})}
            >
              {showSkeleton
                ? Array.from({ length: SKELETON_ROWS }, (_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: placeholders
                    <tr key={i} data-testid="skeleton-row" style={{ height: rowHeight }}>
                      {selection ? (
                        <td
                          aria-hidden
                          style={{ width: SELECT_COLUMN_WIDTH }}
                          className={cn(selectClass, "udc:bg-surface")}
                        />
                      ) : null}
                      {[...left, ...center].map((c, j) => (
                        <td
                          key={c.id}
                          style={pinStyle(c)}
                          className={cn(
                            "udc:border-b udc:border-border udc:bg-surface udc:px-3",
                            pinClass(c),
                          )}
                        >
                          <Skeleton
                            className="udc:h-3"
                            style={{ width: `${45 + ((i * 7 + j * 13) % 45)}%` }}
                          />
                        </td>
                      ))}
                      {addColumnCell("a", "udc:bg-surface")}
                      {filler("f", "udc:border-b udc:border-border udc:bg-surface")}
                      {right.map((c) => (
                        <td
                          key={c.id}
                          style={pinStyle(c)}
                          className={cn(
                            "udc:border-b udc:border-border udc:bg-surface udc:px-3",
                            pinClass(c),
                          )}
                        >
                          <Skeleton className="udc:h-3 udc:w-2/3" />
                        </td>
                      ))}
                      {rowActions ? (
                        <td
                          aria-hidden
                          style={{ width: actionsWidth }}
                          className={cn(actionsClass, "udc:bg-surface")}
                        />
                      ) : null}
                    </tr>
                  ))
                : null}
              {bodyRows}
            </tbody>
          </UdcLookupBatch>
        </table>

        {showError && data.error ? <ErrorState error={data.error} onRetry={data.refetch} /> : null}
        {showEmpty ? <EmptyState filtered={props.filtered} onClear={props.onClearFilters} /> : null}

        {mode === "infinite" && data.rows.length > 0 ? (
          <div
            data-testid="infinite-footer"
            className="udc:sticky udc:left-0 udc:flex udc:h-12 udc:items-center udc:justify-center udc:gap-2 udc:text-xs udc:text-muted-foreground"
            style={{ width: scrollRef.current?.clientWidth }}
          >
            {isFetchingNextPage ? (
              <>
                <Spinner />
                {t("APP", "LOADING_MORE")}
              </>
            ) : hasNextPage ? null : (
              t("APP", "ALL_LOADED", { total: new Intl.NumberFormat(intlLocale).format(total) })
            )}
          </div>
        ) : null}
        <div ref={sentinelRef} data-testid="infinite-sentinel" className="udc:h-px" />
      </div>

      {mode === "pages" &&
      !showError &&
      (data.total === null ? data.rows.length > 0 || props.page > 1 : data.total > 0) ? (
        <Pager
          page={props.page}
          limit={props.limit}
          total={data.total}
          shown={data.rows.length}
          onPage={props.onPage}
        />
      ) : null}
    </div>
  );
}
