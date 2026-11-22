import { useI18n } from "../i18n/i18n.js";
import { cn } from "../lib/utils.js";
import type { UdcChangeFeedStatus } from "../udc/changeFeed.js";
import { useUiKit } from "../ui-kit/context.js";

/**
 * The change feed's state beside the freshness pill: a green "live" while the
 * stream carries the collection, an amber "reconnecting" while it is being
 * reopened (the view polls meanwhile). Nothing otherwise: no feed, the
 * collection does not offer one, still connecting, or refused.
 */
export function LiveIndicator({ status }: { status: UdcChangeFeedStatus }) {
  const { Tip } = useUiKit();
  const { t } = useI18n();
  if (status !== "live" && status !== "reconnecting") return null;
  const live = status === "live";
  return (
    <Tip label={t("APP", live ? "FEED_LIVE_HINT" : "FEED_RECONNECTING_HINT")}>
      <span
        data-testid="feed-status"
        data-status={status}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the tooltip opens on focus too
        tabIndex={0}
        className={cn(
          "udc:inline-flex udc:h-5 udc:items-center udc:gap-1 udc:rounded-full udc:px-2 udc:text-[11px] udc:font-medium udc:whitespace-nowrap udc:outline-none udc:focus-visible:ring-2 udc:focus-visible:ring-ring",
          live
            ? "udc:bg-sem-success-bg udc:text-sem-success"
            : "udc:bg-sem-warning-bg udc:text-sem-warning",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "udc:size-1.5 udc:rounded-full",
            live ? "udc:bg-sem-success" : "udc:bg-sem-warning udc:animate-pulse",
          )}
        />
        {t("APP", live ? "FEED_LIVE" : "FEED_RECONNECTING")}
      </span>
    </Tip>
  );
}
