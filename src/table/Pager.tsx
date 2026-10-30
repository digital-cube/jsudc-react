import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "../i18n/i18n.js";
import { cn } from "../lib/utils.js";
import { useUiKit } from "../ui-kit/context.js";

/** Page numbers to show: first, last, and a window around the current one; `null` is a gap. */
export function pageWindow(page: number, pages: number, radius = 1): (number | null)[] {
  const out: (number | null)[] = [];
  for (let p = 1; p <= pages; p++) {
    const keep = p === 1 || p === pages || Math.abs(p - page) <= radius;
    // A gap of exactly one page shows that page rather than an ellipsis.
    const bridge =
      (p === 2 && page - radius === 3) || (p === pages - 1 && page + radius === pages - 2);
    if (keep || bridge) out.push(p);
    else if (out[out.length - 1] !== null) out.push(null);
  }
  return out;
}

export function Pager({
  page,
  limit,
  total,
  onPage,
}: {
  page: number;
  limit: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const { Button, Tip } = useUiKit();
  const { t, intlLocale } = useI18n();
  const pages = Math.max(1, Math.ceil(total / limit));
  const fmt = (n: number) => new Intl.NumberFormat(intlLocale).format(n);
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);

  const nav = (label: string, target: number, disabled: boolean, icon: ReactNode, id: string) => (
    <Tip label={label}>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={label}
        data-testid={`pager-${id}`}
        disabled={disabled}
        onClick={() => onPage(target)}
      >
        {icon}
      </Button>
    </Tip>
  );

  return (
    <nav
      aria-label={t("APP", "PAGING")}
      data-testid="pager"
      className="udc-pager udc:flex udc:h-11 udc:shrink-0 udc:items-center udc:justify-between udc:gap-4 udc:border-t udc:border-border udc:bg-surface udc:px-3 udc:text-xs udc:text-muted-foreground"
    >
      <div className="udc:tabular-nums">
        {t("APP", "SHOWING_RANGE", { from: fmt(from), to: fmt(to), total: fmt(total) })}
        <span className="udc:mx-2 udc:text-border-strong">·</span>
        {t("APP", "PER_PAGE", { n: limit })}
      </div>
      <div className="udc:flex udc:items-center udc:gap-0.5">
        {nav(t("APP", "PAGE_FIRST"), 1, page <= 1, <ChevronsLeft />, "first")}
        {nav(t("APP", "PAGE_PREV"), page - 1, page <= 1, <ChevronLeft />, "prev")}
        {pageWindow(page, pages).map((p, i) =>
          p === null ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: gaps have no identity
            <span key={`gap-${i}`} className="udc:w-7 udc:text-center">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              data-testid={`pager-page-${p}`}
              aria-current={p === page ? "page" : undefined}
              onClick={() => onPage(p)}
              className={cn(
                "udc:h-7 udc:min-w-7 udc:rounded-md udc:px-1.5 udc:text-xs udc:font-medium udc:tabular-nums udc:transition-colors",
                "udc:focus-visible:outline-none udc:focus-visible:ring-2 udc:focus-visible:ring-ring",
                p === page
                  ? "udc:bg-primary udc:text-primary-foreground udc:shadow-sm"
                  : "udc:text-foreground udc:hover:bg-hover",
              )}
            >
              {p}
            </button>
          ),
        )}
        {nav(t("APP", "PAGE_NEXT"), page + 1, page >= pages, <ChevronRight />, "next")}
        {nav(t("APP", "PAGE_LAST"), pages, page >= pages, <ChevronsRight />, "last")}
      </div>
      <div className="udc:tabular-nums" data-testid="pager-status">
        {t("APP", "PAGE_OF", { page, pages })}
      </div>
    </nav>
  );
}
