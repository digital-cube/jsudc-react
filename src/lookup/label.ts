import type { LookupDef, Row } from "@jsudc/core";

/** What a target row is called: its `label_field`, or `undefined` when it has none. */
export function lookupLabel(row: Row | undefined, lookup: LookupDef): string | undefined {
  const v = row?.[lookup.label_field];
  if (v === null || v === undefined || v === "") return undefined;
  return typeof v === "string" ? v : String(v);
}

/** The extra fields of a target row, `name: value` per line (the link's tooltip). */
export function lookupExtras(row: Row | undefined, lookup: LookupDef): string | undefined {
  if (!row || !lookup.extra_fields?.length) return undefined;
  const lines = lookup.extra_fields
    .map((f) => [f, row[f]] as const)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([f, v]) => `${f}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
  return lines.length ? lines.join("\n") : undefined;
}

/**
 * The colour of a target row's chip: the value of `lookup.color_field` (a
 * named palette value such as `danger` or `red`), or `undefined` when the
 * lookup names no colour field or the row has no value there. Read loosely,
 * so a `@jsudc/core` older than `color_field` passes it through as well.
 */
export function lookupColor(row: Row | undefined, lookup: LookupDef): string | undefined {
  const field: unknown = lookup.color_field;
  if (!row || typeof field !== "string" || field === "") return undefined;
  const v = row[field];
  if (typeof v === "number") return String(v);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}
