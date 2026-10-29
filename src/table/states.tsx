import { AlertTriangle, RotateCw, SearchX, Table2 } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "../i18n/i18n";
import { useUiKit } from "../ui-kit/context";

function Panel({
  icon,
  title,
  body,
  action,
  testId,
  tone = "muted",
}: {
  icon: ReactNode;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  testId: string;
  tone?: "muted" | "danger";
}) {
  return (
    <div
      data-testid={testId}
      className="udc:flex udc:flex-col udc:items-center udc:px-6 udc:py-16 udc:text-center"
    >
      <div
        className={
          tone === "danger"
            ? "udc:mb-4 udc:grid udc:size-12 udc:place-items-center udc:rounded-xl udc:bg-sem-danger-bg udc:text-sem-danger"
            : "udc:mb-4 udc:grid udc:size-12 udc:place-items-center udc:rounded-xl udc:border udc:border-border udc:bg-muted udc:text-muted-foreground"
        }
      >
        {icon}
      </div>
      <div className="udc:text-sm udc:font-semibold">{title}</div>
      {body ? (
        <div className="udc:mt-1 udc:max-w-sm udc:text-[13px] udc:text-muted-foreground">
          {body}
        </div>
      ) : null}
      {action ? <div className="udc:mt-4">{action}</div> : null}
    </div>
  );
}

/** `body` replaces the default text (a view's `empty_label`). */
export function EmptyState({
  filtered,
  onClear,
  body,
}: {
  filtered: boolean;
  onClear: () => void;
  body?: string | undefined;
}) {
  const { Button } = useUiKit();
  const { t } = useI18n();
  return filtered ? (
    <Panel
      testId="table-empty"
      icon={<SearchX className="udc:size-5" />}
      title={t("APP", "EMPTY_TITLE")}
      body={body ?? t("APP", "EMPTY_BODY")}
      action={
        <Button size="sm" onClick={onClear}>
          {t("APP", "CLEAR_FILTERS")}
        </Button>
      }
    />
  ) : (
    <Panel
      testId="table-empty"
      icon={<Table2 className="udc:size-5" />}
      title={t("APP", "EMPTY_TITLE")}
      body={body ?? t("APP", "EMPTY_PLAIN")}
    />
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const { Button } = useUiKit();
  const { t } = useI18n();
  return (
    <Panel
      testId="table-error"
      tone="danger"
      icon={<AlertTriangle className="udc:size-5" />}
      title={t("APP", "ERROR_TITLE")}
      body={<span className="udc:font-mono udc:text-xs">{error.message}</span>}
      action={
        <Button size="sm" onClick={onRetry} data-testid="retry">
          <RotateCw className="udc:size-3.5!" />
          {t("APP", "RETRY")}
        </Button>
      }
    />
  );
}
