import type { FieldDef, LookupDef } from "@jsudc/core";
import { X } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/i18n.js";
import { cn } from "../lib/utils.js";
import { lookupLabel } from "./label.js";
import { type LookupOption, useLookupOptions } from "./options.js";
import { keyString, lookupKeys, useUdcLookup } from "./useUdcLookup.js";

export type ComboboxCommitReason = "enter" | "tab" | "shift-tab" | "blur";

/**
 * The inline editor of a lookup cell: a search over the target collection
 * (`contains` on `label_field`, the first 50 by label) in a list under the
 * cell. On a `lookup` a pick commits that key; on a `lookup_array` a pick
 * adds or removes a key, and Enter on an empty search commits the list.
 * Arrow keys move, Escape cancels, Tab commits and moves on.
 */
export function LookupCombobox({
  def,
  lookup,
  initial,
  saving,
  onCommit,
  onCancel,
}: {
  def: FieldDef;
  lookup: LookupDef;
  initial: unknown;
  saving: boolean;
  /** `value` is the key (or `null`), on a lookup_array the list of keys. */
  onCommit: (value: unknown, reason: ComboboxCommitReason) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const multi = def.type === "lookup_array";
  const [needle, setNeedle] = useState("");
  const [active, setActive] = useState(0);
  // Keys as stored: a number key stays a number when it is written back.
  const [picked, setPicked] = useState<unknown[]>(() =>
    multi ? (Array.isArray(initial) ? [...initial] : []) : [],
  );
  const { options, isLoading } = useLookupOptions(lookup, needle);
  const labels = useUdcLookup(lookup, multi ? picked : [initial]);
  const input = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => input.current?.focus(), []);

  const pickedKeys = new Set(lookupKeys(picked));
  // A single lookup offers "none" first, so a key can be cleared.
  const rows: (LookupOption | null)[] = multi ? options : [null, ...options];

  const commit = (value: unknown, reason: ComboboxCommitReason) => {
    if (done.current || saving) return;
    done.current = true;
    onCommit(value, reason);
  };

  const choose = (o: LookupOption | null, reason: ComboboxCommitReason = "enter") => {
    if (!multi) return commit(o ? o.raw : null, reason);
    if (!o) return;
    setPicked((p) =>
      pickedKeys.has(o.key) ? p.filter((k) => keyString(k) !== o.key) : [...p, o.raw],
    );
    setNeedle("");
    input.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => Math.max(0, Math.min(rows.length - 1, a + step)));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (multi && needle === "") commit(picked, "enter");
      else if (rows.length) choose(rows[active] ?? null);
    } else if (e.key === "Escape") {
      e.preventDefault();
      done.current = true;
      onCancel();
    } else if (e.key === "Tab") {
      e.preventDefault();
      const reason = e.shiftKey ? "shift-tab" : "tab";
      if (multi) commit(picked, reason);
      else {
        done.current = true;
        onCancel();
      }
    } else if (multi && e.key === "Backspace" && needle === "" && picked.length) {
      setPicked((p) => p.slice(0, -1));
    }
  };

  const current = multi ? undefined : lookupLabel(labels.row(initial), lookup);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: focus leaving the whole editor is the commit, not an interaction
    <div
      className="udc:relative udc:flex udc:h-full udc:w-full udc:min-w-0 udc:items-center udc:gap-1"
      data-testid="lookup-combobox"
      onBlur={(e) => {
        // Leaving the editor (not moving inside it) commits a list and drops a single pick.
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        if (multi) commit(picked, "blur");
        else {
          done.current = true;
          onCancel();
        }
      }}
    >
      {multi
        ? picked.map((k) => {
            const key = keyString(k);
            return (
              <span
                key={key}
                data-testid="lookup-picked"
                className="udc:inline-flex udc:h-5 udc:shrink-0 udc:items-center udc:gap-0.5 udc:rounded-full udc:bg-muted udc:pr-0.5 udc:pl-2 udc:text-[11px] udc:font-medium"
              >
                {lookupLabel(labels.row(k), lookup) ?? key}
                <button
                  type="button"
                  aria-label={`${t("APP", "CLEAR")} ${key}`}
                  className="udc:grid udc:size-4 udc:place-items-center udc:rounded-full udc:hover:bg-primary/15"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setPicked((p) => p.filter((x) => keyString(x) !== key))}
                >
                  <X className="udc:size-2.5" />
                </button>
              </span>
            );
          })
        : null}
      <input
        ref={input}
        type="text"
        role="combobox"
        aria-expanded
        aria-controls="udc-lookup-options"
        aria-activedescendant={`udc-lookup-option-${active}`}
        data-testid="lookup-search"
        className="udc:h-full udc:min-w-12 udc:flex-1 udc:bg-transparent udc:text-[13px] udc:text-foreground udc:outline-none"
        value={needle}
        placeholder={current ?? t("APP", "LOOKUP_SEARCH")}
        readOnly={saving}
        onChange={(e) => {
          setNeedle(e.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
      />
      <div
        id="udc-lookup-options"
        role="listbox"
        aria-multiselectable={multi || undefined}
        data-testid="lookup-options"
        className="udc-scroll-thin udc:absolute udc:top-full udc:-left-1.5 udc:z-30 udc:mt-1 udc:max-h-64 udc:w-64 udc:overflow-y-auto udc:rounded-md udc:border udc:border-border udc:bg-surface-raised udc:p-1 udc:text-foreground udc:shadow-md"
      >
        {rows.map((o, i) => {
          const selected = o
            ? multi
              ? pickedKeys.has(o.key)
              : keyString(initial) === o.key
            : false;
          return (
            <div
              key={o?.key ?? "∅"}
              id={`udc-lookup-option-${i}`}
              role="option"
              tabIndex={-1}
              aria-selected={selected}
              data-testid={o ? `lookup-option-${o.key}` : "lookup-option-none"}
              data-label={o?.label}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(o)}
              onKeyDown={() => {}}
              className={cn(
                "udc:flex udc:h-7 udc:cursor-pointer udc:items-center udc:gap-2 udc:rounded-sm udc:px-2 udc:text-[13px]",
                i === active && "udc:bg-hover",
                selected && "udc:font-semibold udc:text-primary",
                !o && "udc:text-muted-foreground",
              )}
            >
              <span className="udc:truncate">{o ? o.label : t("APP", "LOOKUP_NONE")}</span>
            </div>
          );
        })}
        {!isLoading && options.length === 0 ? (
          <div className="udc:px-2 udc:py-1.5 udc:text-xs udc:text-muted-foreground">
            {t("APP", "LOOKUP_NO_MATCH")}
          </div>
        ) : null}
      </div>
    </div>
  );
}
