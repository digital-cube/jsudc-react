import { useI18n } from "../i18n/i18n";
import type { UdcAllRowsResult } from "../udc/hooks";

/**
 * What a renderer over `useUdcAllRows` shows above its content: a thin bar
 * filling while the pages load, and a notice when the cap cut the rows short.
 */
export function AllRowsStatus({ result }: { result: UdcAllRowsResult }) {
  const { t, intlLocale } = useI18n();
  const fmt = (n: number) => new Intl.NumberFormat(intlLocale).format(n);
  const { progress } = result;
  const pct = progress?.total ? Math.min(100, (progress.loaded / progress.total) * 100) : null;
  return (
    <>
      {result.isFetching ? (
        <div
          className="udc:pointer-events-none udc:relative udc:z-30 udc:h-0"
          data-testid="all-rows-progress"
        >
          <div className="udc:h-0.5 udc:w-full udc:overflow-hidden udc:bg-primary/15">
            {pct === null ? (
              <div className="udc:h-full udc:w-1/3 udc:animate-[shimmer_1s_linear_infinite] udc:bg-primary/70" />
            ) : (
              <div
                className="udc:h-full udc:bg-primary/70 udc:transition-[width]"
                style={{ width: `${pct}%` }}
              />
            )}
          </div>
        </div>
      ) : null}
      {result.capped && result.total !== null ? (
        <div
          data-testid="all-rows-capped"
          className="udc:border-b udc:border-border udc:bg-sem-warning-bg udc:px-4 udc:py-1.5 udc:text-xs udc:text-sem-warning"
        >
          {t("APP", "CAPPED", { shown: fmt(result.rows.length), total: fmt(result.total) })}
        </div>
      ) : null}
    </>
  );
}
