// The text and kind of a cell value, without markup: what the table, the cards and the
// chart's axis format with. Part of `@jsudc/react/headless`.
import { COLUMN_COLORS, type ColumnColor, type ColumnConfig, type FieldDef } from "@jsudc/core";
import { zonedFormat } from "../time/zoned";
import { applyTransforms, hasTransforms, parseIsoParts } from "./transforms";

export type RenderKind =
  | "text"
  | "number_format"
  | "bool"
  | "date"
  | "datetime"
  | "number"
  | "bytes"
  | "badge"
  | "icon"
  | "sparkline"
  | "heading_glyph";

/** The column's `render`, or the one its field type implies. */
export function renderKind(column: ColumnConfig, def: FieldDef | undefined): RenderKind {
  switch (column.render) {
    case "text":
    case "number_format":
    case "bool":
    case "date":
    case "datetime":
    case "bytes":
    case "badge":
    case "icon":
    case "sparkline":
    case "heading_glyph":
      return column.render;
  }
  switch (def?.type) {
    case "integer":
    case "decimal":
    case "rating":
      return "number_format";
    case "year":
      return "number";
    case "bool":
      return "bool";
    case "date":
      return "date";
    case "datetime":
      return "datetime";
    default:
      return "text";
  }
}

export function isBlank(v: unknown): boolean {
  return v === null || v === undefined || v === "";
}

export function formatNumber(v: unknown, intlLocale: string, decimals?: number): string {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return String(v);
  return new Intl.NumberFormat(intlLocale, {
    maximumFractionDigits: decimals ?? 2,
    ...(decimals === undefined ? {} : { minimumFractionDigits: decimals }),
  }).format(n);
}

/**
 * A `number_format` value: `render_options.precision` (or `decimals`, the
 * older spelling) fraction digits and `suffix` after it (`" m"`, `"°"`).
 */
export function formatNumberColumn(v: unknown, column: ColumnConfig, intlLocale: string): string {
  const o = column.render_options;
  const digits = o?.precision ?? o?.decimals;
  const text = formatNumber(v, intlLocale, typeof digits === "number" ? digits : undefined);
  return typeof o?.suffix === "string" ? `${text}${o.suffix}` : text;
}

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/** A size in bytes as people read it: `512 B`, `1.5 KB`, `12 MB` (powers of 1024). */
export function formatBytes(v: unknown, intlLocale: string): string {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) return String(v);
  let unit = 0;
  let size = n;
  while (size >= 1024 && unit < BYTE_UNITS.length - 1) {
    size /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || size >= 100 ? 0 : 1;
  const text = new Intl.NumberFormat(intlLocale, { maximumFractionDigits: digits }).format(size);
  return `${text} ${BYTE_UNITS[unit]}`;
}

const isTone = (v: unknown): v is ColumnColor =>
  typeof v === "string" && (COLUMN_COLORS as readonly string[]).includes(v);

/** The tone of one badge value: `render_options.map[value]`, else `render_options.default`, else muted. */
export function badgeTone(value: unknown, options: ColumnConfig["render_options"]): ColumnColor {
  const map = options?.map;
  const mapped =
    map && typeof map === "object" ? (map as Record<string, unknown>)[String(value)] : undefined;
  if (isTone(mapped)) return mapped;
  return isTone(options?.default) ? options.default : "muted";
}

/** A date is a calendar day: formatted in UTC so no time zone moves it. */
export function formatDate(v: unknown, intlLocale: string): string {
  const p = parseIsoParts(v);
  if (!p) return String(v);
  return new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(Date.UTC(p.y, p.m - 1, p.d)),
  );
}

/** An instant, as the clock of `timeZone` (the header's zone; default the browser's) reads it. */
export function formatDateTime(v: unknown, intlLocale: string, timeZone?: string): string {
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  const opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" };
  return timeZone
    ? zonedFormat(intlLocale, timeZone, opts).format(d)
    : new Intl.DateTimeFormat(intlLocale, opts).format(d);
}

/**
 * The text a non-bool cell shows: transforms first, else the render kind's
 * format. `timeZone` moves a `datetime` (a `date` has no zone and never moves).
 */
export function displayText(
  value: unknown,
  column: ColumnConfig,
  kind: RenderKind,
  locale: string,
  intlLocale: string,
  timeZone?: string,
): string {
  const zone = kind === "datetime" ? timeZone : undefined;
  if (hasTransforms(column.transform)) {
    return String(applyTransforms(value, column.transform, locale, zone));
  }
  switch (kind) {
    case "number_format":
      return formatNumberColumn(value, column, intlLocale);
    case "bytes":
      return formatBytes(value, intlLocale);
    case "date":
      return formatDate(value, intlLocale);
    case "datetime":
      return formatDateTime(value, intlLocale, zone);
    default:
      // A string_array reads as a list, not as JSON.
      if (Array.isArray(value) && value.every((v) => typeof v !== "object")) {
        return value.map(String).join(", ");
      }
      return typeof value === "object" ? JSON.stringify(value) : String(value);
  }
}
