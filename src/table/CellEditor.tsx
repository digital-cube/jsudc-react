import { type FieldDef, lookupOf } from "@jsudc/core";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils.js";
import { LookupCombobox } from "../lookup/LookupCombobox.js";
import { useUiKit } from "../ui-kit/context.js";

export type CommitReason = "enter" | "tab" | "shift-tab" | "blur";

export type EditorKind = "text" | "number" | "checkbox" | "date" | "datetime" | "select" | "lookup";

/** What an editor commits: the input's text or checkbox state, or a picked lookup key (list). */
export type EditorRaw = string | boolean | { picked: unknown };

export function editorKind(def: FieldDef | undefined): EditorKind {
  if (lookupOf(def)) return "lookup";
  switch (def?.type) {
    case "integer":
    case "decimal":
    case "year":
    case "rating":
      return "number";
    case "bool":
      return "checkbox";
    case "date":
      return "date";
    case "datetime":
      return "datetime";
    case "enum":
      return "select";
    default:
      return "text";
  }
}

/** What the editor's input shows for a stored value. */
export function toEditorValue(v: unknown, kind: EditorKind): string | boolean {
  if (kind === "checkbox") return v === true;
  if (v === null || v === undefined) return "";
  if (kind === "datetime" && typeof v === "string") return v.slice(0, 16);
  return String(v);
}

/**
 * The stored value for the editor's input, or `{error}` when the input
 * cannot be one (the server validates the rest: range, required, length).
 */
export function fromEditorValue(
  raw: EditorRaw,
  kind: EditorKind,
  def: FieldDef | undefined,
): { value: unknown } | { error: string } {
  if (typeof raw === "object") return { value: raw.picked };
  if (kind === "checkbox") return { value: raw === true };
  const s = String(raw);
  if (s.trim() === "") return { value: null };
  if (kind === "number") {
    const n = Number(s);
    if (!Number.isFinite(n)) return { error: "must be a number" };
    if ((def?.type === "integer" || def?.type === "year") && !Number.isInteger(n)) {
      return { error: "must be a whole number" };
    }
    return { value: n };
  }
  if (kind === "datetime") return { value: new Date(s).toISOString() };
  return { value: s };
}

export function sameValue(a: unknown, b: unknown): boolean {
  const norm = (v: unknown) => (v === undefined || v === "" ? null : v);
  if (Array.isArray(a) || Array.isArray(b))
    return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
  return norm(a) === norm(b);
}

/**
 * The input that replaces a cell while it is edited. Enter / blur commit,
 * Tab / Shift+Tab commit and move, Escape cancels.
 */
export function CellEditor({
  def,
  initial,
  saving,
  error,
  errorSeq = 0,
  align,
  onCommit,
  onCancel,
}: {
  def: FieldDef | undefined;
  initial: unknown;
  saving: boolean;
  error: string | null;
  /** Bumped on every failed save, so the same message twice still re-arms the editor. */
  errorSeq?: number;
  align?: "left" | "right" | "center" | undefined;
  onCommit: (raw: EditorRaw, reason: CommitReason) => void;
  onCancel: () => void;
}) {
  const { Spinner } = useUiKit();
  const kind = editorKind(def);
  const lookup = lookupOf(def);
  const [raw, setRaw] = useState<string | boolean>(() =>
    kind === "lookup" ? "" : toEditorValue(initial, kind),
  );
  const ref = useRef<HTMLInputElement & HTMLSelectElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    if (el instanceof HTMLInputElement && (kind === "text" || kind === "number")) el.select();
  }, [kind]);

  // A failed save re-arms the editor so the next Enter / blur commits again.
  useEffect(() => {
    if (error && errorSeq >= 0) done.current = false;
  }, [error, errorSeq]);

  const commit = (reason: CommitReason, value: string | boolean = raw) => {
    if (done.current || saving) return;
    done.current = true;
    onCommit(value, reason);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit("enter");
    } else if (e.key === "Escape") {
      e.preventDefault();
      done.current = true;
      onCancel();
    } else if (e.key === "Tab") {
      e.preventDefault();
      commit(e.shiftKey ? "shift-tab" : "tab");
    }
  };

  const shell = cn(
    "udc:absolute udc:inset-0 udc:z-20 udc:flex udc:items-center udc:bg-surface udc:px-1.5",
    "udc:ring-2 udc:ring-inset",
    error ? "udc:ring-sem-danger" : "udc:ring-ring",
  );
  const field = cn(
    "udc:h-full udc:w-full udc:min-w-0 udc:bg-transparent udc:text-[13px] udc:text-foreground udc:outline-none",
    align === "right" && "udc:text-right udc:tabular-nums",
    align === "center" && "udc:text-center",
  );

  return (
    <div className={shell} data-testid="cell-editor">
      {kind === "lookup" && def && lookup ? (
        <LookupCombobox
          def={def}
          lookup={lookup}
          initial={initial}
          saving={saving}
          onCommit={(picked, reason) => onCommit({ picked }, reason)}
          onCancel={onCancel}
        />
      ) : kind === "checkbox" ? (
        <label className="udc:flex udc:h-full udc:w-full udc:cursor-pointer udc:items-center udc:justify-center">
          <input
            ref={ref}
            type="checkbox"
            className="udc:size-4 udc:accent-[var(--primary)]"
            checked={raw === true}
            disabled={saving}
            onChange={(e) => setRaw(e.target.checked)}
            onKeyDown={onKeyDown}
            onBlur={() => commit("blur")}
          />
        </label>
      ) : kind === "select" ? (
        <select
          ref={ref}
          className={cn(field, "udc:bg-surface")}
          value={String(raw)}
          disabled={saving}
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => commit("blur")}
        >
          <option value="">—</option>
          {(def?.values ?? []).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      ) : (
        <input
          ref={ref}
          type={
            kind === "number"
              ? "number"
              : kind === "date"
                ? "date"
                : kind === "datetime"
                  ? "datetime-local"
                  : "text"
          }
          className={cn(field, "udc:[&::-webkit-inner-spin-button]:hidden")}
          value={String(raw)}
          readOnly={saving}
          maxLength={kind === "text" ? def?.length : undefined}
          min={def?.min}
          max={def?.max}
          onChange={(e) => {
            if (error) done.current = false;
            setRaw(e.target.value);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => commit("blur")}
        />
      )}
      {saving ? <Spinner className="udc:ml-1 udc:shrink-0 udc:text-muted-foreground" /> : null}
      {error ? (
        <div
          role="alert"
          data-testid="cell-error"
          className="udc:absolute udc:top-full udc:left-0 udc:z-30 udc:mt-1 udc:w-max udc:max-w-72 udc:rounded-md udc:border udc:border-sem-danger/40 udc:bg-sem-danger-bg udc:px-2 udc:py-1 udc:text-xs udc:font-medium udc:text-sem-danger udc:shadow-md"
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
