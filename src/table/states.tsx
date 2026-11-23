import { isUnauthenticated } from "@jsudc/core";
import { AlertTriangle, LogIn, RotateCw, SearchX, Table2 } from "lucide-react";
import type { ReactNode } from "react";
import { tableSection, useI18n } from "../i18n/i18n.js";
import { useUiKit } from "../ui-kit/context.js";

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

/**
 * No rows. Its strings are looked up in the collection's own section first
 * (`TBL_<COLLECTION>.EMPTY_TITLE` / `EMPTY_BODY` / `EMPTY_PLAIN`, as
 * `SEARCH_PLACEHOLDER` is), then in `APP`: an empty mail folder can say "No
 * messages here." without every other view of the app saying it too. `body`
 * replaces the default text (a view's `empty_label`) and wins over both.
 */
export function EmptyState({
  filtered,
  onClear,
  body,
  collection,
}: {
  filtered: boolean;
  onClear: () => void;
  body?: string | undefined;
  /** The collection whose `TBL_<COLLECTION>` section is asked first. */
  collection?: string | undefined;
}) {
  const { Button } = useUiKit();
  const { t, tMaybe } = useI18n();
  const term = (key: string) =>
    (collection ? tMaybe(tableSection(collection), key) : null) ?? t("APP", key);
  return filtered ? (
    <Panel
      testId="table-empty"
      icon={<SearchX className="udc:size-5" />}
      title={term("EMPTY_TITLE")}
      body={body ?? term("EMPTY_BODY")}
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
      title={term("EMPTY_TITLE")}
      body={body ?? term("EMPTY_PLAIN")}
    />
  );
}

/**
 * A failed load. "Not signed in" (`isUnauthenticated`: an HTTP 401, or the
 * server's in-protocol refusal) is a state of the session, not of the data:
 * it says so (`APP.SIGNED_OUT_TITLE` / `SIGNED_OUT_BODY`) and offers no Retry,
 * which would only be refused again. Anything else shows its message and Retry.
 */
export function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const { Button } = useUiKit();
  const { t } = useI18n();
  if (isUnauthenticated(error)) {
    return (
      <Panel
        testId="signed-out"
        icon={<LogIn className="udc:size-5" />}
        title={t("APP", "SIGNED_OUT_TITLE")}
        body={t("APP", "SIGNED_OUT_BODY")}
      />
    );
  }
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

/**
 * A tab whose renderer the host did not register: the registry is explicit
 * (`UdcProvider renderers={…}`), so this is a setup error, not missing data.
 */
export function NoRendererState({ name }: { name: string }) {
  const { t } = useI18n();
  return (
    <Panel
      testId="no-renderer"
      icon={<Table2 className="udc:size-5" />}
      title={t("APP", "NO_RENDERER_TITLE", { name })}
      body={t("APP", "NO_RENDERER_BODY")}
    />
  );
}
