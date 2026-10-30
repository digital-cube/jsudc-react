import { FileCode2, TriangleAlert } from "lucide-react";
import { useI18n } from "../i18n/i18n.js";
import { formatDateTime } from "../table/format.js";
import { ErrorState } from "../table/states.js";
import { useTimezone } from "../time/timezone.js";
import { useUdcSource } from "../udc/hooks.js";
import { useUiKit } from "../ui-kit/context.js";

/**
 * The file a `source_yaml` collection is read from, as written: its path
 * and modification time over the text, with line numbers. When the file
 * no longer parses the server keeps serving the last good read; the reason
 * is shown above the text.
 */
export function SourceTab({ collection }: { collection: string }) {
  const { Skeleton } = useUiKit();
  const { t, intlLocale } = useI18n();
  const { timeZone } = useTimezone();
  const source = useUdcSource(collection);

  if (source.error) {
    return (
      <div className="udc:flex udc:flex-1 udc:items-center udc:justify-center udc:p-6">
        <ErrorState error={source.error} onRetry={() => void source.refetch()} />
      </div>
    );
  }
  const data = source.data;
  const lines = data ? data.text.replace(/\n$/, "").split("\n") : [];
  return (
    <div className="udc:flex udc:min-h-0 udc:flex-1 udc:flex-col" data-testid="source-tab">
      <div className="udc:flex udc:flex-wrap udc:items-center udc:gap-x-4 udc:gap-y-1 udc:border-b udc:border-border udc:px-4 udc:py-2.5 udc:text-xs">
        <span className="udc:flex udc:items-center udc:gap-1.5 udc:font-medium udc:text-foreground">
          <FileCode2 className="udc:size-3.5 udc:text-muted-foreground" aria-hidden />
          {data ? (
            <code data-testid="source-path" className="udc:font-mono">
              {data.path}
            </code>
          ) : (
            <Skeleton className="udc:h-3 udc:w-40" />
          )}
        </span>
        {data ? (
          <span
            className="udc:text-muted-foreground"
            data-testid="source-mtime"
            data-mtime={data.mtime}
          >
            {t("APP", "SOURCE_MODIFIED", {
              when: formatDateTime(data.mtime, intlLocale, timeZone),
            })}
          </span>
        ) : null}
        {data ? (
          <span className="udc:ml-auto udc:text-muted-foreground udc:tabular-nums">
            {t("APP", "SOURCE_LINES", { count: lines.length })}
          </span>
        ) : null}
      </div>
      {data?.error ? (
        <div
          data-testid="source-error"
          className="udc:flex udc:items-start udc:gap-2 udc:border-b udc:border-border udc:bg-sem-warning-bg udc:px-4 udc:py-2 udc:text-xs udc:text-foreground"
        >
          <TriangleAlert className="udc:mt-px udc:size-3.5 udc:shrink-0" aria-hidden />
          <div>
            <div className="udc:font-medium">{t("APP", "SOURCE_STALE")}</div>
            <pre className="udc:mt-1 udc:font-mono udc:whitespace-pre-wrap udc:text-muted-foreground">
              {data.error}
            </pre>
          </div>
        </div>
      ) : null}
      <div className="udc-scroll-thin udc:min-h-0 udc:flex-1 udc:overflow-auto udc:bg-muted/40">
        {data ? (
          <pre
            data-testid="source-text"
            className="udc:min-w-max udc:py-3 udc:font-mono udc:text-[12.5px] udc:leading-5 udc:text-foreground"
          >
            {lines.map((line, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a line is its number
              <div key={i} className="udc:flex">
                <span
                  aria-hidden
                  className="udc:w-12 udc:shrink-0 udc:pr-4 udc:text-right udc:text-muted-foreground/60 udc:select-none udc:tabular-nums"
                >
                  {i + 1}
                </span>
                <code
                  className={line.trimStart().startsWith("#") ? "udc:text-muted-foreground" : ""}
                >
                  {line || " "}
                </code>
              </div>
            ))}
          </pre>
        ) : (
          <div className="udc:flex udc:flex-col udc:gap-2 udc:p-4">
            <Skeleton className="udc:h-3 udc:w-2/3" />
            <Skeleton className="udc:h-3 udc:w-1/2" />
            <Skeleton className="udc:h-3 udc:w-3/5" />
          </div>
        )}
      </div>
    </div>
  );
}
