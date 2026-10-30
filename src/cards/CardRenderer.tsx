import type { ColumnColor, DescribeResponse, Row } from "@jsudc/core";
import { useEffect, useMemo, useRef } from "react";
import { FolderEntry } from "../data-view/FolderEntry.js";
import { tableSection, useI18n } from "../i18n/i18n.js";
import { cn } from "../lib/utils.js";
import type { FolderNav } from "../renderers/types.js";
import { CellValue } from "../table/cells.js";
import { displayText, isBlank, renderKind } from "../table/format.js";
import { Pager } from "../table/Pager.js";
import { Sparkline } from "../table/sparkline.js";
import { EmptyState, ErrorState } from "../table/states.js";
import { resolveRowColor } from "../table/style.js";
import { useInfiniteSentinel } from "../table/useInfiniteSentinel.js";
import { useTimezone } from "../time/timezone.js";
import type { UdcCollectionResult } from "../udc/hooks.js";
import type { PagingMode } from "../udc/keys.js";
import { useUiKit } from "../ui-kit/context.js";
import {
  avatarTone,
  CARD_MIN_WIDTH,
  type CardSlots,
  cardSlots,
  initials,
  metricText,
} from "./cardModel.js";

/** The `row_color` accent bar on the left edge. Literal classes so Tailwind sees them. */
const ACCENT_BAR: Record<ColumnColor, string> = {
  default: "udc:bg-border-strong",
  accent: "udc:bg-sem-accent",
  success: "udc:bg-sem-success",
  warning: "udc:bg-sem-warning",
  danger: "udc:bg-sem-danger",
  info: "udc:bg-sem-info",
  muted: "udc:bg-sem-muted/60",
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

const SKELETON_CARDS = 12;

export interface CardRendererProps {
  collection: string;
  describe: DescribeResponse;
  data: UdcCollectionResult;
  mode: PagingMode;
  page: number;
  limit: number;
  onPage: (page: number) => void;
  filtered: boolean;
  onClearFilters: () => void;
  /** Changes whenever the cards are a different query; scrolls back to the top. */
  resetKey: string;
  /** A folder listing: a folder card opens the folder, a file card its preview. */
  folder?: FolderNav | undefined;
}

/**
 * The rows as a responsive grid of cards, from `view.card_options`. Same
 * data, paging and states as the table; read-only in phase 1.
 */
export function CardRenderer(props: CardRendererProps) {
  const { Spinner } = useUiKit();
  const { collection, describe, data, mode } = props;
  const { view } = describe;
  const { t, intlLocale } = useI18n();
  const slots = useMemo(() => cardSlots(view), [view]);
  const section = tableSection(collection);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  useInfiniteSentinel(mode === "infinite", scrollRef, sentinelRef, data);

  useEffect(() => {
    if (props.resetKey && scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [props.resetKey]);

  const showSkeleton = data.isLoading && data.rows.length === 0;
  const showError = data.error !== null && data.rows.length === 0;
  const showEmpty = !showSkeleton && !showError && data.rows.length === 0;
  const total = data.total ?? data.rows.length;
  const grid = {
    gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${CARD_MIN_WIDTH[slots.size]}px), 1fr))`,
  };

  return (
    <div className="udc:flex udc:min-h-0 udc:flex-1 udc:flex-col">
      <div
        ref={scrollRef}
        data-testid="cards-scroll"
        className="udc-scroll-thin udc:relative udc:min-h-0 udc:flex-1 udc:overflow-auto udc:bg-background/60"
      >
        {data.isFetching && !data.isLoading && !data.isFetchingNextPage ? (
          <div className="udc:pointer-events-none udc:sticky udc:top-0 udc:z-30 udc:h-0">
            <div className="udc:h-0.5 udc:w-full udc:overflow-hidden udc:bg-primary/15">
              <div className="udc:h-full udc:w-1/3 udc:animate-[shimmer_1s_linear_infinite] udc:bg-primary/70" />
            </div>
          </div>
        ) : null}

        {showSkeleton || data.rows.length > 0 ? (
          <div
            data-testid="card-grid"
            data-size={slots.size}
            aria-busy={data.isFetching}
            className="udc:grid udc:gap-3 udc:p-4"
            style={grid}
          >
            {showSkeleton
              ? Array.from({ length: SKELETON_CARDS }, (_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: placeholders
                  <SkeletonCard key={i} meta={slots.meta.length} seed={i} />
                ))
              : data.rows.map((row) => (
                  <Card
                    key={row.__meta.id}
                    row={row}
                    slots={slots}
                    describe={describe}
                    section={section}
                    accent={resolveRowColor(row, view.row_color)}
                    folder={props.folder}
                  />
                ))}
          </div>
        ) : null}

        {showError && data.error ? <ErrorState error={data.error} onRetry={data.refetch} /> : null}
        {showEmpty ? <EmptyState filtered={props.filtered} onClear={props.onClearFilters} /> : null}

        {mode === "infinite" && data.rows.length > 0 ? (
          <div
            data-testid="infinite-footer"
            className="udc:flex udc:h-12 udc:items-center udc:justify-center udc:gap-2 udc:text-xs udc:text-muted-foreground"
          >
            {data.isFetchingNextPage ? (
              <>
                <Spinner />
                {t("APP", "LOADING_MORE")}
              </>
            ) : data.hasNextPage ? null : (
              t("APP", "ALL_LOADED", { total: new Intl.NumberFormat(intlLocale).format(total) })
            )}
          </div>
        ) : null}
        <div ref={sentinelRef} data-testid="infinite-sentinel" className="udc:h-px" />
      </div>

      {mode === "pages" && !showError && (data.total ?? 0) > 0 ? (
        <Pager
          page={props.page}
          limit={props.limit}
          total={data.total ?? 0}
          onPage={props.onPage}
        />
      ) : null}
    </div>
  );
}

function Card({
  row,
  slots,
  describe,
  section,
  accent,
  folder,
}: {
  row: Row;
  slots: CardSlots;
  describe: DescribeResponse;
  section: string;
  accent: ReturnType<typeof resolveRowColor>;
  folder?: FolderNav | undefined;
}) {
  const { t, locale, intlLocale } = useI18n();
  const { timeZone } = useTimezone();
  const { schema } = describe;
  const text = (col: CardSlots["title"]) => {
    const v = row[col.field];
    if (isBlank(v)) return "";
    const kind = renderKind(col, schema.fields[col.field]);
    return displayText(v, col, kind, locale, intlLocale, timeZone);
  };
  const title = text(slots.title);
  const subtitle = slots.subtitle ? text(slots.subtitle) : "";
  const image = slots.image ? row[slots.image] : null;
  const hasImage = typeof image === "string" && image !== "";
  const cover = hasImage && slots.imageStyle === "cover";
  const tone = accent?.color ?? accent?.bg;

  return (
    <article
      data-testid="card"
      data-row-id={row.__meta.id}
      data-accent={tone ?? undefined}
      className={cn(
        "udc-card",
        "udc:group/card udc:relative udc:flex udc:min-w-0 udc:flex-col udc:overflow-hidden udc:rounded-xl udc:border udc:border-border udc:bg-surface udc:shadow-xs udc:shadow-black/[0.03]",
        "udc:transition-[transform,box-shadow,border-color] udc:duration-150 udc:ease-out udc:hover:-translate-y-0.5 udc:hover:border-border-strong udc:hover:shadow-md udc:hover:shadow-black/[0.06] udc:dark:hover:shadow-black/40",
      )}
    >
      {tone && tone !== "default" ? (
        <span
          aria-hidden
          data-testid="card-accent"
          className={cn("udc:absolute udc:inset-y-0 udc:left-0 udc:w-[3px]", ACCENT_BAR[tone])}
        />
      ) : null}
      {cover ? (
        <img
          src={image as string}
          alt=""
          loading="lazy"
          data-testid="card-cover"
          className="udc:aspect-[16/9] udc:w-full udc:border-b udc:border-border udc:bg-muted udc:object-cover"
        />
      ) : null}
      <div className="udc:flex udc:items-center udc:gap-3 udc:px-4 udc:pt-3.5 udc:pb-3">
        {hasImage && !cover ? (
          <img
            src={image as string}
            alt=""
            loading="lazy"
            data-testid="card-image-avatar"
            className="udc:size-9 udc:shrink-0 udc:rounded-full udc:border udc:border-border udc:bg-muted udc:object-cover"
          />
        ) : null}
        {hasImage ? null : (
          <span
            aria-hidden
            data-testid="card-avatar"
            className={cn(
              "udc:grid udc:size-9 udc:shrink-0 udc:place-items-center udc:rounded-lg udc:text-[13px] udc:font-semibold udc:tracking-tight",
              AVATAR[avatarTone(title)],
            )}
          >
            {initials(title)}
          </span>
        )}
        <div className="udc:min-w-0 udc:flex-1">
          <h3
            data-testid="card-title"
            className="udc:truncate udc:text-sm udc:leading-5 udc:font-semibold udc:tracking-tight"
            title={title}
          >
            {folder ? (
              <FolderEntry row={row} nav={folder}>
                <span className="udc:truncate">{title}</span>
              </FolderEntry>
            ) : (
              title || <span className="udc:text-muted-foreground/60">—</span>
            )}
          </h3>
          {slots.subtitle ? (
            <p
              data-testid="card-subtitle"
              className="udc:truncate udc:text-xs udc:leading-4 udc:text-muted-foreground udc:tabular-nums"
            >
              {subtitle ? (
                <>
                  <span className="udc:text-muted-foreground/70">
                    {t(section, slots.subtitle.field)}
                  </span>{" "}
                  {subtitle}
                </>
              ) : (
                "—"
              )}
            </p>
          ) : null}
        </div>
      </div>
      {slots.metric ? (
        <div
          data-testid="card-metric"
          className="udc:flex udc:items-baseline udc:justify-between udc:gap-3 udc:border-t udc:border-border/70 udc:px-4 udc:py-2.5"
        >
          <span className="udc:text-xs udc:text-muted-foreground">
            {slots.metric.label ?? t(section, slots.metric.field)}
          </span>
          <span
            data-testid="card-metric-value"
            className="udc:text-xl udc:leading-7 udc:font-semibold udc:tracking-tight udc:tabular-nums"
          >
            {metricText(row[slots.metric.field], slots.metric, intlLocale) ?? (
              <span className="udc:text-muted-foreground/50">—</span>
            )}
          </span>
        </div>
      ) : null}
      {slots.meta.length ? (
        <dl className="udc:mt-auto udc:flex udc:flex-col udc:border-t udc:border-border/70 udc:px-4 udc:py-2">
          {slots.meta.map((col) => (
            <div
              key={col.field}
              data-testid={`card-meta-${col.field}`}
              className="udc:flex udc:min-h-7 udc:min-w-0 udc:items-center udc:justify-between udc:gap-3 udc:border-b udc:border-dashed udc:border-border/80 udc:py-1 udc:last:border-b-0"
            >
              <dt className="udc:shrink-0 udc:text-xs udc:text-muted-foreground">
                {t(section, col.field)}
              </dt>
              <dd className="udc:flex udc:min-w-0 udc:items-center udc:justify-end udc:text-right udc:text-[13px] udc:font-medium">
                <CellValue
                  value={row[col.field]}
                  column={col}
                  def={schema.fields[col.field]}
                  locale={locale}
                  intlLocale={intlLocale}
                />
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {slots.sparkline ? (
        <div
          data-testid="card-sparkline"
          className="udc:border-t udc:border-border/70 udc:px-4 udc:py-2.5"
        >
          <Sparkline
            value={row[slots.sparkline.field]}
            width={slots.sparkline.width}
            height={slots.sparkline.height}
            format={(n) =>
              slots.metric ? (metricText(n, slots.metric, intlLocale) ?? "") : String(n)
            }
            className="udc:h-auto udc:max-w-full"
          />
        </div>
      ) : null}
    </article>
  );
}

function SkeletonCard({ meta, seed }: { meta: number; seed: number }) {
  const { Skeleton } = useUiKit();
  return (
    <div
      data-testid="skeleton-card"
      className="udc:flex udc:flex-col udc:overflow-hidden udc:rounded-xl udc:border udc:border-border udc:bg-surface"
    >
      <div className="udc:flex udc:items-center udc:gap-3 udc:px-4 udc:pt-3.5 udc:pb-3">
        <Skeleton className="udc:size-9 udc:rounded-lg" />
        <div className="udc:flex udc:flex-1 udc:flex-col udc:gap-1.5">
          <Skeleton className="udc:h-3.5" style={{ width: `${55 + ((seed * 17) % 35)}%` }} />
          <Skeleton className="udc:h-2.5 udc:w-1/3" />
        </div>
      </div>
      <div className="udc:flex udc:flex-col udc:gap-3 udc:border-t udc:border-border/70 udc:px-4 udc:py-3.5">
        {Array.from({ length: Math.max(2, meta) }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholders
          <div key={i} className="udc:flex udc:items-center udc:justify-between udc:gap-6">
            <Skeleton className="udc:h-2.5 udc:w-16" />
            <Skeleton className="udc:h-3" style={{ width: `${20 + ((seed + i * 11) % 35)}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
