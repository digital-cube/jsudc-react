import type { SourceInfo } from "@jsudc/core";
import { CloudOff, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n/i18n.js";
import { cn } from "../lib/utils.js";
import { useUiKit } from "../ui-kit/context.js";

/** "12 s ago", "3 min ago", "pre 12 s": the age of a fetched copy. */
export function ageText(fetchedAt: string, now: number, intlLocale: string): string {
  const s = Math.max(0, Math.round((now - Date.parse(fetchedAt)) / 1000));
  const rtf = new Intl.RelativeTimeFormat(intlLocale, { numeric: "always", style: "short" });
  if (s < 60) return rtf.format(-s, "second");
  if (s < 3600) return rtf.format(-Math.floor(s / 60), "minute");
  return rtf.format(-Math.floor(s / 3600), "hour");
}

/** A cache TTL as people read it: "15 s", "4 min", "2 h". */
export function ttlText(ms: number, intlLocale: string): string {
  const s = Math.round(ms / 1000);
  const [n, unit] =
    s < 60
      ? [s, "second"]
      : s < 3600
        ? [Math.round(s / 6) / 10, "minute"]
        : [Math.round(s / 360) / 10, "hour"];
  return new Intl.NumberFormat(intlLocale, { style: "unit", unit, unitDisplay: "short" }).format(n);
}

/**
 * For a source that serves a fetched copy (http_api): how old the copy is,
 * ticking, and a warning pill when the last refresh failed and the copy is
 * stale. Its tooltip says when it was fetched and, from `describe.source`,
 * the credential the server uses and how long it keeps a copy — why the
 * upstream is asked every few minutes while the page polls more often.
 * Nothing for a live source.
 */
export function Freshness({
  fetchedAt,
  stale,
  source,
}: {
  fetchedAt: string | null;
  stale: boolean;
  source?: SourceInfo | undefined;
}) {
  const { Tip } = useUiKit();
  const { t, intlLocale } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!fetchedAt) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, [fetchedAt]);
  if (!fetchedAt) return null;
  return (
    <span className="udc:flex udc:items-center udc:gap-1.5">
      {stale ? (
        <Tip label={t("APP", "STALE_HINT")}>
          <span
            data-testid="stale-pill"
            className="udc:inline-flex udc:h-5 udc:items-center udc:gap-1 udc:rounded-full udc:bg-sem-warning-bg udc:px-2 udc:text-[11px] udc:font-medium udc:text-sem-warning"
          >
            <CloudOff className="udc:size-3" />
            {t("APP", "STALE")}
          </span>
        </Tip>
      ) : null}
      <Tip
        label={
          <span className="udc:flex udc:flex-col udc:gap-0.5" data-testid="freshness-tip">
            <span>
              {t("APP", "FRESH_FETCHED", {
                when: new Date(fetchedAt).toLocaleString(intlLocale),
              })}
            </span>
            {source?.auth ? (
              <span data-testid="freshness-auth">
                {t("APP", "FRESH_AUTH", {
                  auth: t("APP", source.auth === "oauth2" ? "AUTH_OAUTH2" : "AUTH_ANONYMOUS"),
                })}
              </span>
            ) : null}
            {source?.cache_ttl_ms !== undefined ? (
              <span data-testid="freshness-cache">
                {source.cache_ttl_ms > 0
                  ? t("APP", "FRESH_CACHE", { ttl: ttlText(source.cache_ttl_ms, intlLocale) })
                  : t("APP", "FRESH_NO_CACHE")}
              </span>
            ) : null}
          </span>
        }
      >
        <span
          data-testid="updated-ago"
          data-fetched-at={fetchedAt}
          data-auth={source?.auth}
          data-cache-ttl={source?.cache_ttl_ms}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: the tooltip opens on focus too
          tabIndex={0}
          className={cn(
            "udc:inline-flex udc:items-center udc:gap-1 udc:rounded-sm udc:text-xs udc:whitespace-nowrap udc:text-muted-foreground udc:tabular-nums udc:outline-none udc:focus-visible:ring-2 udc:focus-visible:ring-ring",
          )}
        >
          <RefreshCw className="udc:size-3" />
          {t("APP", "UPDATED_AGO", { age: ageText(fetchedAt, now, intlLocale) })}
        </span>
      </Tip>
    </span>
  );
}
