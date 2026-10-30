import type { ColumnColor, ColumnConfig, FieldDef } from "@jsudc/core";
import { Check, X } from "lucide-react";
import type { ReactNode } from "react";
import { resolveIcon } from "../icons/resolve.js";
import { cn } from "../lib/utils.js";
import { useTimezone } from "../time/timezone.js";
import { HeadingGlyph, Sparkline } from "./sparkline.js";

export {
  badgeTone,
  displayText,
  formatBytes,
  formatDate,
  formatDateTime,
  formatNumber,
  formatNumberColumn,
  isBlank,
  type RenderKind,
  renderKind,
} from "./format.js";

import { badgeTone, displayText, formatNumber, isBlank, renderKind } from "./format.js";

function BoolValue({ value, style }: { value: unknown; style: unknown }) {
  const on = value === true;
  if (style === "badge") {
    return (
      <span
        className={cn(
          "udc:inline-flex udc:h-5 udc:items-center udc:rounded-full udc:px-2 udc:text-[11px] udc:font-medium",
          on
            ? "udc:bg-sem-success-bg udc:text-sem-success"
            : "udc:bg-muted udc:text-muted-foreground",
        )}
      >
        {on ? "✓" : "–"}
      </span>
    );
  }
  return on ? (
    <span
      data-bool="true"
      className="udc:inline-grid udc:size-5 udc:place-items-center udc:rounded-full udc:bg-sem-success-bg udc:text-sem-success"
    >
      <Check className="udc:size-3.5" strokeWidth={2.75} aria-label="true" />
    </span>
  ) : (
    <span
      data-bool="false"
      className="udc:inline-grid udc:size-5 udc:place-items-center udc:rounded-full udc:text-sem-muted/70"
    >
      <X className="udc:size-3.5" strokeWidth={2.5} aria-label="false" />
    </span>
  );
}

/** Badge tone → classes. Literal strings so Tailwind sees them. */
const BADGE: Record<ColumnColor, string> = {
  default: "udc:bg-muted udc:text-foreground",
  accent: "udc:bg-sem-accent-bg udc:text-sem-accent",
  success: "udc:bg-sem-success-bg udc:text-sem-success",
  warning: "udc:bg-sem-warning-bg udc:text-sem-warning",
  danger: "udc:bg-sem-danger-bg udc:text-sem-danger",
  info: "udc:bg-sem-info-bg udc:text-sem-info",
  muted: "udc:bg-muted udc:text-muted-foreground",
};

/** One pill per value (a `string_array` is several), toned by `render_options.map`. */
export function Badges({ value, column }: { value: unknown; column: ColumnConfig }) {
  const values = (Array.isArray(value) ? value : [value]).filter((v) => !isBlank(v));
  return (
    <span className="udc:flex udc:min-w-0 udc:items-center udc:gap-1 udc:overflow-hidden">
      {values.map((v, i) => {
        const tone = badgeTone(v, column.render_options);
        return (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: values may repeat
            key={i}
            data-testid="badge"
            data-tone={tone}
            className={cn(
              "udc:inline-flex udc:h-5 udc:shrink-0 udc:items-center udc:rounded-full udc:px-2 udc:text-[11px] udc:font-medium udc:whitespace-nowrap",
              BADGE[tone],
            )}
          >
            {typeof v === "object" ? JSON.stringify(v) : String(v)}
          </span>
        );
      })}
    </span>
  );
}

/** What one table cell shows. */
export function CellValue({
  value,
  column,
  def,
  locale,
  intlLocale,
}: {
  value: unknown;
  column: ColumnConfig;
  def: FieldDef | undefined;
  locale: string;
  intlLocale: string;
}): ReactNode {
  const { timeZone } = useTimezone();
  const kind = renderKind(column, def);
  if (kind === "bool" && !isBlank(value)) {
    return <BoolValue value={value} style={column.render_options?.style} />;
  }
  if (isBlank(value) || (Array.isArray(value) && value.length === 0)) {
    return <span className="udc:text-muted-foreground/50">—</span>;
  }
  if (kind === "badge") return <Badges value={value} column={column} />;
  if (kind === "sparkline") {
    const o = column.render_options;
    return (
      <Sparkline
        value={value}
        width={typeof o?.width === "number" ? o.width : undefined}
        height={typeof o?.height === "number" ? o.height : undefined}
        format={(n) => formatNumber(n, intlLocale, 0)}
      />
    );
  }
  if (kind === "heading_glyph") return <HeadingGlyph value={value} />;
  if (kind === "icon") {
    const Icon = resolveIcon(value);
    return Icon ? (
      <span title={String(value)} data-testid="icon-value" data-icon={String(value)}>
        <Icon className="udc:size-4 udc:text-muted-foreground" aria-hidden />
      </span>
    ) : null;
  }
  const text = displayText(value, column, kind, locale, intlLocale, timeZone);
  return (
    <span
      className={cn(
        "udc:block udc:truncate",
        kind === "number_format" || kind === "number" || kind === "bytes" ? "udc:tabular-nums" : "",
      )}
      title={typeof value === "string" && value.length > 24 ? value : undefined}
    >
      {text}
    </span>
  );
}
