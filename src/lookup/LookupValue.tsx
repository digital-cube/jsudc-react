import {
  type FieldDef,
  type LookupDef,
  lookupKeyField,
  lookupOf,
  ROW_ID,
  type Row,
} from "@jsudc/core";
import type { CSSProperties, MouseEvent } from "react";
import { cn } from "../lib/utils.js";
import { BADGE_TONE, isTone } from "../table/format.js";
import { batchCovers, useLookupBatchContext } from "./batch.js";
import { lookupColor, lookupExtras, lookupLabel } from "./label.js";
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

/**
 * The fill of a chip whose colour is no tone: the host maps the name to
 * `--udc-chip-bg` / `--udc-chip-fg`, e.g.
 * `.udc-lookup-chip[data-color="red"] { --udc-chip-bg: …; --udc-chip-fg: …; }`
 * (and again under `.dark`); a name it does not map draws as the default chip.
 */
const NAMED_CHIP: CSSProperties = {
  backgroundColor: "var(--udc-chip-bg, var(--muted))",
  color: "var(--udc-chip-fg, var(--foreground))",
};

/**
 * How fast chip `index` of a `lookup_array` gives up width when the chips do
 * not fit: each chip a million times faster than the one before it, so the
 * first chips keep their width and the last visible one ends in "…" (down to
 * its minimum, then the one before it). Capped so the factor stays a finite
 * single-precision float; chips that far along are past the cell's edge.
 */
const chipShrink = (index: number): number => 1e6 ** Math.min(index, 6);

function LookupLink({
  lookup,
  keyValue,
  row,
  chip,
  editable,
  shrink,
}: {
  lookup: LookupDef;
  keyValue: string;
  row: Row | undefined;
  chip: boolean;
  editable: boolean;
  /** A chip's `flex-shrink` in its row of chips. */
  shrink?: number;
}) {
  const links = useUdcLinks();
  const label = lookupLabel(row, lookup);
  // A chip takes the colour of its row (`lookup.color_field`): a tone draws as
  // that tone's badge, any other name is the host's (`data-color`, NAMED_CHIP).
  const color = chip ? lookupColor(row, lookup) : undefined;
  const tone = isTone(color) ? color : undefined;
  const field = lookupKeyField(lookup);
  // `null`: the host has no view of the target (`UdcLinks.href`), so the value
  // is plain text and a click on it is the row's.
  const href = filterHref(links, lookup.collection, {
    field: field === ROW_ID ? ROW_ID : field,
    op: "eq",
    value: keyValue,
  });
  const onClick = (e: MouseEvent) => {
    if (href === null) return;
    // In an editable cell a plain click belongs to the cell (double-click edits);
    // Cmd / Ctrl-click still opens the target.
    if (editable && !(e.metaKey || e.ctrlKey || e.button === 1)) {
      e.preventDefault();
      return;
    }
    // The row under the link may have a row_link of its own: the link wins.
    e.stopPropagation();
    followLink(e, href, links);
  };
  const text = label ?? keyValue;
  const style: CSSProperties = {
    ...(color !== undefined && !tone ? NAMED_CHIP : {}),
    ...(shrink !== undefined ? { flexShrink: shrink } : {}),
  };
  const props = {
    "data-testid": "lookup-link",
    "data-key": keyValue,
    "data-resolved": label !== undefined || undefined,
    "data-color": color,
    "data-tone": tone,
    "data-link": href !== null || undefined,
    title: lookupExtras(row, lookup) ?? label ?? keyValue,
    className: cn(
      "udc:min-w-0 udc:truncate udc:text-foreground",
      href !== null &&
        "udc:underline-offset-2 udc:hover:text-primary udc:hover:underline udc:focus-visible:underline udc:focus-visible:outline-none",
      // The chip's box is a flex container, whose text would be an anonymous flex
      // item that `text-overflow` does not reach: the text is a span of its own
      // that truncates, inside a box at most `--udc-chip-max-width` wide that may
      // shrink to `--udc-chip-min-width` (default 2.5rem, "K…") but keeps its rounded ends.
      chip &&
        "udc-lookup-chip udc:inline-flex udc:h-5 udc:justify-center udc:max-w-[var(--udc-chip-max-width,12em)] udc:min-w-[min(var(--udc-chip-min-width,2.5rem),var(--udc-chip-max-width,12em))] udc:items-center udc:rounded-full udc:px-2 udc:text-[length:var(--udc-chip-font-size,11px)] udc:font-[number:var(--udc-chip-font-weight,500)]",
      chip && href !== null && "udc:hover:no-underline",
      chip && color === undefined && "udc:bg-muted",
      chip && color === undefined && href !== null && "udc:hover:bg-primary/12",
      chip && color !== undefined && href !== null && "udc:hover:opacity-80",
      tone && BADGE_TONE[tone],
      label === undefined && "udc:font-mono udc:text-muted-foreground",
    ),
    style: Object.keys(style).length > 0 ? style : undefined,
  };
  const body = chip ? (
    <span data-testid="lookup-chip-text" className="udc:min-w-0 udc:truncate">
      {text}
    </span>
  ) : (
    text
  );
  return href === null ? (
    <span {...props}>{body}</span>
  ) : (
    <a {...props} href={href} onClick={onClick}>
      {body}
    </a>
  );
}

/**
 * A `lookup` cell: the target's `label_field` as a link to the target
 * collection filtered by the key (`?f=` `{field: <key field>, op: eq}`), the
 * bare key until the label arrives or when the target has no such row. A
 * `lookup_array` is a list of such chips; with `lookup.color_field` each chip
 * takes its row's colour (`data-color`; a tone such as `danger` draws as that
 * badge, any other name through the host's `--udc-chip-bg` / `--udc-chip-fg`).
 * A long chip ends in "…" inside its rounded box, at most
 * `--udc-chip-max-width` (default `12em`) wide; when the chips do not fit, the
 * first keep their width and the last visible one shrinks. Where `UdcLinks.href`
 * gives `null` for the target, the label and the chips are plain text.
 */
export function LookupValue({
  def,
  value,
  field,
  editable = false,
}: {
  def: FieldDef;
  value: unknown;
  /** The field, so the batch around the cell (if any) answers for it. */
  field?: string | undefined;
  /** In an editable cell a plain click does not follow the link (Cmd / Ctrl-click does). */
  editable?: boolean;
}) {
  const { lookup, keys, row } = useLookupRows(def, value, field);
  if (!lookup) return <span className="udc:truncate">{keys.join(", ")}</span>;
  if (def.type === "lookup_array") {
    return (
      <span
        data-testid="lookup-chips"
        className="udc:flex udc:min-w-0 udc:items-center udc:gap-1 udc:overflow-hidden"
      >
        {keys.map((k, i) => (
          <LookupLink
            key={k}
            lookup={lookup}
            keyValue={k}
            row={row(k)}
            chip
            editable={editable}
            shrink={chipShrink(i)}
          />
        ))}
      </span>
    );
  }
  const key = keys[0];
  return key === undefined ? null : (
    <LookupLink
      lookup={lookup}
      keyValue={keyString(key)}
      row={row(key)}
      chip={false}
      editable={editable}
    />
  );
}
