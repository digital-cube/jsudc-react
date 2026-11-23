import {
  type ColumnConfig,
  type DescribeResponse,
  type FieldDef,
  type FilterNode,
  isCondition,
  isRowIdField,
  type SchemaDoc,
  type SortKey,
  type ViewConfig,
} from "@jsudc/core";

/** A field the schema has and has not soft-deleted. */
export function isLiveField(schema: SchemaDoc, field: string): boolean {
  return Object.hasOwn(schema.fields, field) && schema.fields[field]?.deleted !== true;
}

/**
 * The view with every reference to a field the schema no longer has (or has
 * soft-deleted) taken out: chips, search fields, card slots, `row_color`; and
 * the columns marked `hidden: true`.
 * `describe` already drops such columns and filter-builder fields; the rest
 * of `view.yaml` is served as written, and a request naming a deleted field
 * would be refused by the server's allowlist.
 */
export function liveView(view: ViewConfig, schema: SchemaDoc): ViewConfig {
  const live = (f: string | undefined) => f !== undefined && isLiveField(schema, f);
  const out: ViewConfig = {
    ...view,
    // `hidden: true` (core 0.5.2, read loosely): `describe` of a 0.5.2 server already left it out.
    columns: view.columns.filter(
      (c) => live(c.field) && (c as { hidden?: unknown }).hidden !== true,
    ),
  };
  if (view.filters) out.filters = view.filters.filter((c) => live(c.field));
  if (view.search) out.search = { ...view.search, fields: view.search.fields.filter(live) };
  if (view.card_options) {
    const { title_field, subtitle_field, image_field, meta_fields, ...rest } = view.card_options;
    out.card_options = {
      ...rest,
      ...(live(title_field) ? { title_field } : {}),
      ...(live(subtitle_field) ? { subtitle_field } : {}),
      ...(live(image_field) ? { image_field } : {}),
      ...(meta_fields ? { meta_fields: meta_fields.filter(live) } : {}),
    };
  }
  if (view.row_color && !live(view.row_color.field)) delete out.row_color;
  return out;
}

/** `describe` with `liveView` applied. */
export function liveDescribe(d: DescribeResponse): DescribeResponse {
  return { ...d, view: liveView(d.view, d.schema) };
}

/**
 * The fields the collection's source sorts on: `describe.sortable.fields`
 * (core 0.5.2, read loosely so an older core's types carry it too); `null`
 * when `describe` does not say (a server before 0.5.2), which means every field.
 */
export function sourceSortable(
  d: Pick<DescribeResponse, "schema"> | undefined,
): ReadonlySet<string> | null {
  const raw = (d as { sortable?: unknown } | undefined)?.sortable;
  const fields = (raw as { fields?: unknown } | null | undefined)?.fields;
  if (!Array.isArray(fields)) return null;
  return new Set(fields.filter((f): f is string => typeof f === "string"));
}

/**
 * Whether a column's header offers a sort: the field is in the schema and not
 * `json`, the source sorts on it (`sourceSortable`), and the column is not
 * marked `sortable: false` (core 0.5.2, read loosely).
 */
export function columnSortable(
  config: Pick<ColumnConfig, "field">,
  def: FieldDef | undefined,
  sortable: ReadonlySet<string> | null,
): boolean {
  if (def === undefined || def.type === "json") return false;
  if ((config as { sortable?: unknown }).sortable === false) return false;
  return sortable === null || sortable.has(config.field);
}

/**
 * Sort keys on live fields only, and, given `sortable` (`sourceSortable`),
 * only on fields the source sorts on: a sort in the URL or a default naming
 * another would make every list fail with `validation_error`.
 */
export function liveSort(
  sort: readonly SortKey[],
  schema: SchemaDoc,
  sortable: ReadonlySet<string> | null = null,
): SortKey[] {
  return sort.filter(
    (k) => isLiveField(schema, k.field) && (sortable === null || sortable.has(k.field)),
  );
}

/**
 * The tree without conditions on fields that are gone; an emptied group
 * disappears, and `null` when nothing is left.
 */
export function pruneTree(tree: FilterNode | null, schema: SchemaDoc): FilterNode | null {
  if (!tree) return null;
  // `id` stays when it means the row id (a lookup link opens the target that way).
  if (isCondition(tree)) {
    return isLiveField(schema, tree.field) || isRowIdField(schema, tree.field) ? tree : null;
  }
  if ("not" in tree) {
    const inner = pruneTree(tree.not, schema);
    return inner ? { not: inner } : null;
  }
  const key = "and" in tree ? "and" : "or";
  const kids = ("and" in tree ? tree.and : tree.or)
    .map((n) => pruneTree(n, schema))
    .filter((n): n is FilterNode => n !== null);
  if (kids.length === 0) return null;
  return (key === "and" ? { and: kids } : { or: kids }) as FilterNode;
}
