import { isUdcError } from "@jsudc/core";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../i18n/i18n.js";
import { useUdcSchema } from "../udc/hooks.js";
import { useUiKit } from "../ui-kit/context.js";

/** Confirms a soft delete: the column goes, the data stays. */
export function DeleteFieldDialog({
  collection,
  field,
  label,
  onDeleted,
  onCancel,
}: {
  collection: string;
  field: string;
  label: string;
  onDeleted: () => void;
  onCancel: () => void;
}) {
  const { Button, DialogBody, DialogContent, DialogFooter, Spinner } = useUiKit();
  const { t } = useI18n();
  const { softDeleteField } = useUdcSchema(collection);
  const [error, setError] = useState<string | null>(null);
  const pending = softDeleteField.isPending;

  const confirm = async () => {
    setError(null);
    try {
      await softDeleteField.mutateAsync(field);
      onDeleted();
    } catch (err) {
      setError(isUdcError(err) || err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <DialogContent
      className="udc-schema-editor"
      role="alertdialog"
      data-testid="delete-field"
      title={t("APP", "DELETE_TITLE", { label })}
      onEscapeKeyDown={(e) => pending && e.preventDefault()}
      onInteractOutside={(e) => pending && e.preventDefault()}
    >
      <DialogBody className="udc:flex udc:gap-3">
        <span className="udc:grid udc:size-9 udc:shrink-0 udc:place-items-center udc:rounded-lg udc:bg-sem-danger-bg udc:text-sem-danger">
          <Trash2 className="udc:size-4" />
        </span>
        <div className="udc:min-w-0 udc:text-[13px] udc:text-muted-foreground">
          <p data-testid="delete-field-body">{t("APP", "DELETE_BODY")}</p>
          <p className="udc:mt-2">
            {t("APP", "DELETE_FIELD_NAME")}{" "}
            <code className="udc:rounded-sm udc:bg-muted udc:px-1 udc:py-0.5 udc:font-mono udc:text-xs udc:text-foreground">
              {field}
            </code>
          </p>
          {error ? (
            <p
              role="alert"
              data-testid="delete-field-error"
              className="udc:mt-3 udc:flex udc:items-start udc:gap-1.5 udc:text-sem-danger"
            >
              <AlertTriangle className="udc:mt-0.5 udc:size-3.5 udc:shrink-0" />
              {error}
            </p>
          ) : null}
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          {t("APP", "CANCEL")}
        </Button>
        <Button
          variant="danger"
          data-testid="delete-field-confirm"
          onClick={() => void confirm()}
          disabled={pending}
        >
          {pending ? <Spinner /> : null}
          {t("APP", "DELETE_CONFIRM")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
