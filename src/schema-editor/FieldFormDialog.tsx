import { type FieldType, isUdcError, type SchemaDoc, type SchemaPosition } from "@jsudc/core";
import { AlertTriangle, Lock } from "lucide-react";
import { type FormEvent, type ReactNode, useId, useState } from "react";
import { useI18n } from "../i18n/i18n";
import { cn } from "../lib/utils";
import { useUdcSchema } from "../udc/hooks";
import { useUiKit } from "../ui-kit/context";
import {
  type DraftErrors,
  draftFromDef,
  draftToFieldDef,
  emptyDraft,
  type FieldDraft,
  FORM_TYPES,
  nameProblem,
  suggestName,
  typeControls,
  validateDraft,
} from "./fieldForm";
import { TagInput } from "./TagInput";

export type FieldFormTarget =
  | { mode: "add"; position: SchemaPosition }
  | { mode: "edit"; field: string };

/**
 * The add / edit column form, inside an open `<Dialog>`. Client-side
 * validation runs before anything is sent; what the server still refuses
 * (`validation_error`, `unsupported_op`) is shown inline, and the dialog
 * stays open.
 */
export function FieldFormDialog({
  collection,
  schema,
  target,
  fieldLabel,
  onSaved,
  onCancel,
}: {
  collection: string;
  schema: SchemaDoc;
  target: FieldFormTarget;
  fieldLabel: (field: string) => string;
  onSaved: (name: string, label: string) => void;
  onCancel: () => void;
}) {
  const { Button, DialogBody, DialogContent, DialogFooter, Input, NativeSelect, Spinner } =
    useUiKit();
  const { t, locale } = useI18n();
  const id = useId();
  const { addField, updateField } = useUdcSchema(collection);
  const mode = target.mode;
  const current = mode === "edit" ? schema.fields[target.field] : undefined;

  const [draft, setDraft] = useState<FieldDraft>(() =>
    target.mode === "edit" && current ? draftFromDef(target.field, current) : emptyDraft(),
  );
  const [nameTouched, setNameTouched] = useState(mode === "edit");
  const [attempted, setAttempted] = useState(false);
  const [serverError, setServerError] = useState<{ code: string; message: string } | null>(null);
  const pending = addField.isPending || updateField.isPending;

  const set = <K extends keyof FieldDraft>(key: K, v: FieldDraft[K]) => {
    setServerError(null);
    setDraft((d) => {
      const next = { ...d, [key]: v };
      if (key === "labelEn" && !nameTouched && mode === "add") next.name = suggestName(String(v));
      return next;
    });
  };

  const errors: DraftErrors = attempted ? validateDraft(draft, mode, schema) : {};
  // The name is checked live, as the user types; an empty one only after a submit.
  const liveName = draft.name ? nameProblem(draft.name, mode, schema) : null;
  const nameError = errors.name ?? liveName;
  const controls = typeControls(draft.type);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    const problems = validateDraft(draft, mode, schema);
    if (Object.keys(problems).length) {
      const first = Object.keys(problems)[0];
      document.getElementById(`${id}-${first}`)?.focus();
      return;
    }
    setServerError(null);
    const fielddef = draftToFieldDef(draft, current);
    try {
      if (target.mode === "add") {
        await addField.mutateAsync({ name: draft.name, fielddef, position: target.position });
      } else {
        await updateField.mutateAsync({ name: target.field, fielddef });
      }
      const label =
        (locale === "sr" ? draft.labelSr : draft.labelEn).trim() || draft.labelEn.trim();
      onSaved(draft.name, label || fieldLabel(draft.name));
    } catch (err) {
      setServerError(
        isUdcError(err)
          ? { code: err.code, message: err.message }
          : { code: "internal", message: err instanceof Error ? err.message : String(err) },
      );
    }
  };

  const position = target.mode === "add" ? target.position : null;
  const positionNote = position
    ? position.where === "end" || !position.anchor
      ? t("APP", "FORM_POS_END")
      : t("APP", position.where === "before" ? "FORM_POS_BEFORE" : "FORM_POS_AFTER", {
          label: fieldLabel(position.anchor),
        })
    : null;

  return (
    <DialogContent
      className="udc-schema-editor"
      data-testid="field-form"
      data-mode={mode}
      title={
        mode === "add"
          ? t("APP", "FORM_ADD_TITLE")
          : t("APP", "FORM_EDIT_TITLE", { label: fieldLabel(draft.name) })
      }
      description={positionNote ?? t("APP", "FORM_EDIT_BODY")}
      onEscapeKeyDown={(e) => pending && e.preventDefault()}
      onInteractOutside={(e) => pending && e.preventDefault()}
    >
      <form
        noValidate
        onSubmit={(e) => void submit(e)}
        className="udc:flex udc:min-h-0 udc:flex-col"
      >
        <DialogBody className="udc:flex udc:flex-col udc:gap-4">
          <div className="udc:grid udc:grid-cols-2 udc:gap-3">
            <Field
              id={`${id}-name`}
              label={t("APP", "FORM_NAME")}
              error={nameError ? t("APP", nameError) : null}
              hint={mode === "add" ? t("APP", "FORM_NAME_HINT") : null}
            >
              <Input
                id={`${id}-name`}
                data-testid="field-name"
                value={draft.name}
                readOnly={mode === "edit"}
                autoFocus={mode === "add"}
                autoComplete="off"
                spellCheck={false}
                placeholder="website"
                aria-invalid={nameError ? true : undefined}
                onChange={(e) => {
                  setNameTouched(true);
                  set("name", e.target.value);
                }}
                className={cn(
                  "udc:font-mono udc:text-[12.5px]",
                  mode === "edit" && "udc:bg-muted udc:text-muted-foreground",
                  nameError &&
                    "udc:border-sem-danger udc:focus-visible:border-sem-danger udc:focus-visible:ring-sem-danger/20",
                )}
              />
            </Field>
            <Field id={`${id}-type`} label={t("APP", "FORM_TYPE")}>
              <NativeSelect
                id={`${id}-type`}
                data-testid="field-type"
                value={draft.type}
                disabled={mode === "edit"}
                onChange={(e) => set("type", e.target.value as FieldType)}
              >
                {(FORM_TYPES.includes(draft.type) ? FORM_TYPES : [draft.type, ...FORM_TYPES]).map(
                  (type) => (
                    <option key={type} value={type}>
                      {t("APP", `TYPE_${type}`)}
                    </option>
                  ),
                )}
              </NativeSelect>
            </Field>
          </div>
          {mode === "edit" ? (
            <p
              data-testid="type-locked"
              className="udc:-mt-2 udc:flex udc:items-start udc:gap-1.5 udc:text-xs udc:text-muted-foreground"
            >
              <Lock className="udc:mt-px udc:size-3 udc:shrink-0" />
              {t("APP", "FORM_TYPE_LOCKED")}
            </p>
          ) : null}

          <div className="udc:grid udc:grid-cols-2 udc:gap-3">
            <Field id={`${id}-label-en`} label={t("APP", "FORM_LABEL_EN")} badge="EN">
              <Input
                id={`${id}-label-en`}
                data-testid="field-label-en"
                value={draft.labelEn}
                placeholder="Website"
                onChange={(e) => set("labelEn", e.target.value)}
              />
            </Field>
            <Field id={`${id}-label-sr`} label={t("APP", "FORM_LABEL_SR")} badge="SR">
              <Input
                id={`${id}-label-sr`}
                data-testid="field-label-sr"
                value={draft.labelSr}
                placeholder="Veb sajt"
                onChange={(e) => set("labelSr", e.target.value)}
              />
            </Field>
          </div>

          {controls.length ? (
            <Field
              id={`${id}-length`}
              label={t("APP", "FORM_LENGTH")}
              hint={t("APP", "FORM_LENGTH_HINT")}
              error={errors.length ? t("APP", errors.length) : null}
            >
              <Input
                id={`${id}-length`}
                data-testid="field-length"
                type="number"
                min={1}
                inputMode="numeric"
                value={draft.length}
                onChange={(e) => set("length", e.target.value)}
                className="udc:w-32 udc:tabular-nums"
              />
            </Field>
          ) : null}
          {controls.range ? (
            <div className="udc:grid udc:grid-cols-2 udc:gap-3">
              {(["min", "max"] as const).map((k) => (
                <Field
                  key={k}
                  id={`${id}-${k}`}
                  label={t("APP", k === "min" ? "FORM_MIN" : "FORM_MAX")}
                  error={errors[k] ? t("APP", errors[k]) : null}
                >
                  <Input
                    id={`${id}-${k}`}
                    data-testid={`field-${k}`}
                    type="number"
                    step={draft.type === "decimal" ? "any" : 1}
                    value={draft[k]}
                    placeholder={t("APP", "FORM_NO_LIMIT")}
                    onChange={(e) => set(k, e.target.value)}
                    className="udc:tabular-nums"
                  />
                </Field>
              ))}
            </div>
          ) : null}
          {controls.values ? (
            <Field
              id={`${id}-values`}
              label={t("APP", "FORM_VALUES")}
              hint={t("APP", "FORM_VALUES_HINT")}
              error={errors.values ? t("APP", errors.values) : null}
            >
              <TagInput
                id={`${id}-values`}
                data-testid="field-values"
                value={draft.values}
                invalid={!!errors.values}
                onChange={(v) => set("values", v)}
              />
            </Field>
          ) : null}

          <div className="udc:grid udc:grid-cols-2 udc:gap-3 udc:rounded-lg udc:border udc:border-border udc:bg-muted/40 udc:p-3">
            <Toggle
              id={`${id}-required`}
              testId="field-required"
              checked={draft.required}
              onChange={(v) => set("required", v)}
              label={t("APP", "FORM_REQUIRED")}
              hint={t("APP", "FORM_REQUIRED_HINT")}
            />
            <Toggle
              id={`${id}-index`}
              testId="field-index"
              checked={draft.index}
              onChange={(v) => set("index", v)}
              label={t("APP", "FORM_INDEX")}
              hint={t("APP", "FORM_INDEX_HINT")}
            />
          </div>

          {serverError ? (
            <div
              role="alert"
              data-testid="field-form-error"
              data-code={serverError.code}
              className="udc:flex udc:items-start udc:gap-2 udc:rounded-lg udc:border udc:border-sem-danger/30 udc:bg-sem-danger-bg udc:px-3 udc:py-2.5 udc:text-[13px] udc:text-sem-danger"
            >
              <AlertTriangle className="udc:mt-0.5 udc:size-4 udc:shrink-0" />
              <div className="udc:min-w-0">
                <div className="udc:font-medium">{t("APP", "FORM_SERVER_ERROR")}</div>
                <div className="udc:mt-0.5 udc:text-xs udc:break-words udc:opacity-90">
                  {serverError.message}
                </div>
              </div>
            </div>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            {t("APP", "CANCEL")}
          </Button>
          <Button
            type="submit"
            variant="primary"
            data-testid="field-form-submit"
            disabled={pending}
          >
            {pending ? <Spinner /> : null}
            {mode === "add" ? t("APP", "FORM_ADD_SUBMIT") : t("APP", "SAVE")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  badge,
  children,
}: {
  id: string;
  label: string;
  hint?: string | null;
  error?: string | null;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <div className="udc:flex udc:min-w-0 udc:flex-col udc:gap-1.5">
      <label
        htmlFor={id}
        className="udc:flex udc:items-center udc:gap-1.5 udc:text-xs udc:font-medium"
      >
        {label}
        {badge ? (
          <span className="udc:rounded udc:border udc:border-border udc:px-1 udc:font-mono udc:text-[9.5px] udc:leading-3.5 udc:text-muted-foreground">
            {badge}
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p data-testid="field-error" data-for={id} className="udc:text-xs udc:text-sem-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="udc:text-xs udc:text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function Toggle({
  id,
  testId,
  checked,
  onChange,
  label,
  hint,
}: {
  id: string;
  testId: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  const { Checkbox } = useUiKit();
  return (
    <div className="udc:flex udc:items-start udc:gap-2.5">
      <Checkbox
        id={id}
        data-testid={testId}
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="udc:mt-0.5"
      />
      <label htmlFor={id} className="udc:min-w-0 udc:cursor-pointer udc:select-none">
        <span className="udc:block udc:text-[13px] udc:leading-5 udc:font-medium">{label}</span>
        <span className="udc:block udc:text-xs udc:text-muted-foreground">{hint}</span>
      </label>
    </div>
  );
}
