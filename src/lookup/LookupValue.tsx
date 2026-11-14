import {
  type FieldDef,
  type LookupDef,
  lookupKeyField,
  lookupOf,
  ROW_ID,
  type Row,
} from "@jsudc/core";
import type { MouseEvent } from "react";
import { cn } from "../lib/utils.js";
import { batchCovers, useLookupBatchContext } from "./batch.js";
import { lookupExtras, lookupLabel } from "./label.js";
import { filterHref, followLink, useUdcLinks } from "./links.js";
import { keyString, useUdcLookup, valueKeys } from "./useUdcLookup.js";

/**
 * The labels of a lookup value, from the batch around (`UdcLookupBatch`) or,
 * outside one, from a `useUdcLookup` of its own. `field` names the batch
 * entry. A key not (yet) resolved maps to `undefined`.
 */
export function useLookupRows(
  def: FieldDef | undefined,
  value: unknown,
  field?: string,
): { lookup: LookupDef | undefined; keys: string[]; row: (key: string) => Row | undefined } {
  const lookup = lookupOf(def);
  const keys = valueKeys([value]);
  const batch = useLookupBatchContext();
  const fromBatch = lookup ? batchCovers(batch, field, lookup, keys) : undefined;
  const own = useUdcLookup(lookup ?? { collection: "", label_field: "" }, keys, {
    enabled: lookup !== undefined && fromBatch === undefined,
  });
  const res = fromBatch ?? own;
  return { lookup, keys, row: (key) => res.row(key) };
}

/** The labels of a lookup value as strings, the bare key where no label is known. */
export function useLookupLabels(
  def: FieldDef | undefined,
  value: unknown,
  field?: string,
): string[] {
  const { lookup, keys, row } = useLookupRows(def, value, field);
  if (!lookup) return keys;
  return keys.map((k) => lookupLabel(row(k), lookup) ?? k);
}

function LookupLink({
  lookup,
  keyValue,
  row,
  chip,
}: {
  lookup: LookupDef;
  keyValue: string;
  row: Row | undefined;
  chip: boolean;
}) {
  const links = useUdcLinks();
  const label = lookupLabel(row, lookup);
  const field = lookupKeyField(lookup);
  const href = filterHref(links, lookup.collection, {
    field: field === ROW_ID ? ROW_ID : field,
    op: "eq",
    value: keyValue,
  });
  const onClick = (e: MouseEvent) => {
    // The row under the link may have a row_link of its own: the link wins.
    e.stopPropagation();
    followLink(e, href, links);
  };
  return (
    <a
      href={href}
      onClick={onClick}
      onDoubleClick={(e) => e.stopPropagation()}
      data-testid="lookup-link"
      data-key={keyValue}
      data-resolved={label !== undefined || undefined}
      title={lookupExtras(row, lookup) ?? label ?? keyValue}
      className={cn(
        "udc:min-w-0 udc:truncate udc:text-foreground udc:underline-offset-2 udc:hover:text-primary udc:hover:underline udc:focus-visible:underline udc:focus-visible:outline-none",
        chip &&
          "udc:inline-flex udc:h-5 udc:shrink-0 udc:items-center udc:rounded-full udc:bg-muted udc:px-2 udc:text-[11px] udc:font-medium udc:hover:no-underline udc:hover:bg-primary/12",
        label === undefined && "udc:font-mono udc:text-muted-foreground",
      )}
    >
      {label ?? keyValue}
    </a>
  );
}

/**
 * A `lookup` cell: the target's `label_field` as a link to the target
 * collection filtered by the key (`?f=` `{field: <key field>, op: eq}`), the
 * bare key until the label arrives or when the target has no such row. A
 * `lookup_array` is a list of such chips.
 */
export function LookupValue({
  def,
  value,
  field,
}: {
  def: FieldDef;
  value: unknown;
  /** The field, so the batch around the cell (if any) answers for it. */
  field?: string | undefined;
}) {
  const { lookup, keys, row } = useLookupRows(def, value, field);
  if (!lookup) return <span className="udc:truncate">{keys.join(", ")}</span>;
  if (def.type === "lookup_array") {
    return (
      <span
        data-testid="lookup-chips"
        className="udc:flex udc:min-w-0 udc:items-center udc:gap-1 udc:overflow-hidden"
      >
        {keys.map((k) => (
          <LookupLink key={k} lookup={lookup} keyValue={k} row={row(k)} chip />
        ))}
      </span>
    );
  }
  const key = keys[0];
  return key === undefined ? null : (
    <LookupLink lookup={lookup} keyValue={keyString(key)} row={row(key)} chip={false} />
  );
}
