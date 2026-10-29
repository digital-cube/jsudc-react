import type { FilterChipConfig } from "@jsudc/core";
import { Check, ChevronDown, PlusCircle, X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useI18n } from "../i18n/i18n";
import { cn, humanize } from "../lib/utils";
import { useUiKit } from "../ui-kit/context";
import { type ChipState, type ChipValue, isEmptyChip } from "./urlState";

type Label = (cfg: FilterChipConfig) => string;

/** The chip bar: one popover per `view.filters` entry. */
export function FilterChips({
  configs,
  state,
  onChange,
  label,
}: {
  configs: readonly FilterChipConfig[];
  state: ChipState;
  onChange: (next: ChipState) => void;
  label: Label;
}) {
  const set = (field: string, v: ChipValue | null) => {
    const next = { ...state };
    if (v === null || isEmptyChip(v)) delete next[field];
    else next[field] = v;
    onChange(next);
  };

  return (
    <div className="udc:flex udc:flex-wrap udc:items-center udc:gap-1.5" data-testid="filter-chips">
      {configs.map((cfg) => {
        const v = state[cfg.field];
        const value = v && v.kind === cfg.kind ? v : undefined;
        const props = { cfg, label: label(cfg), onClear: () => set(cfg.field, null) };
        if (cfg.kind === "select") {
          return (
            <SelectChip
              key={cfg.field}
              {...props}
              value={value as Extract<ChipValue, { kind: "select" }> | undefined}
              onChange={(values) => set(cfg.field, { kind: "select", values })}
            />
          );
        }
        if (cfg.kind === "range") {
          return (
            <RangeChip
              key={cfg.field}
              {...props}
              value={value as Extract<ChipValue, { kind: "range" }> | undefined}
              onChange={(min, max) => set(cfg.field, { kind: "range", min, max })}
            />
          );
        }
        return (
          <BoolChip
            key={cfg.field}
            {...props}
            value={value as Extract<ChipValue, { kind: "bool" }> | undefined}
            onChange={(b) => set(cfg.field, b === null ? null : { kind: "bool", value: b })}
          />
        );
      })}
    </div>
  );
}

function ChipTrigger({
  field,
  label,
  summary,
  onClear,
}: {
  field: string;
  label: string;
  summary: string | null;
  onClear: () => void;
}) {
  const { PopoverTrigger } = useUiKit();
  const { t } = useI18n();
  const active = summary !== null;
  return (
    <div
      className={cn(
        "udc:inline-flex udc:h-7 udc:items-center udc:rounded-full udc:border udc:text-xs udc:font-medium udc:transition-colors",
        active
          ? "udc:border-primary/40 udc:bg-primary/8 udc:text-foreground"
          : "udc:border-dashed udc:border-border-strong udc:text-muted-foreground udc:hover:border-solid udc:hover:bg-hover udc:hover:text-foreground",
      )}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={`chip-${field}`}
          data-active={active || undefined}
          className={cn(
            "udc:inline-flex udc:h-full udc:items-center udc:gap-1.5 udc:rounded-full udc:outline-none udc:focus-visible:ring-2 udc:focus-visible:ring-ring",
            active ? "udc:pr-1 udc:pl-2.5" : "udc:px-2.5",
          )}
        >
          {active ? null : <PlusCircle className="udc:size-3.5" />}
          <span>{label}</span>
          {active ? (
            <>
              <span className="udc:h-3.5 udc:w-px udc:bg-primary/30" />
              <span className="udc:max-w-40 udc:truncate udc:text-primary">{summary}</span>
            </>
          ) : (
            <ChevronDown className="udc:size-3 udc:opacity-60" />
          )}
        </button>
      </PopoverTrigger>
      {active ? (
        <button
          type="button"
          onClick={onClear}
          aria-label={`${t("APP", "CLEAR")} ${label}`}
          data-testid={`chip-clear-${field}`}
          className="udc:mr-1 udc:grid udc:size-5 udc:place-items-center udc:rounded-full udc:text-muted-foreground udc:hover:bg-primary/15 udc:hover:text-foreground"
        >
          <X className="udc:size-3" />
        </button>
      ) : null}
    </div>
  );
}

function ChipPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <div className="udc:mb-2 udc:text-[11px] udc:font-semibold udc:tracking-wide udc:text-muted-foreground udc:uppercase">
        {title}
      </div>
      {children}
    </>
  );
}

function SelectChip({
  cfg,
  label,
  value,
  onChange,
  onClear,
}: {
  cfg: FilterChipConfig;
  label: string;
  value: { values: string[] } | undefined;
  onChange: (values: string[]) => void;
  onClear: () => void;
}) {
  const { Button, Checkbox, Input, Popover, PopoverContent } = useUiKit();
  const { t } = useI18n();
  const [needle, setNeedle] = useState("");
  const selected = value?.values ?? [];
  const options = (cfg.options ?? []).map(String);
  const shown = needle
    ? options.filter((o) => o.toLocaleLowerCase().includes(needle.toLocaleLowerCase()))
    : options;
  const summary =
    selected.length === 0
      ? null
      : selected.length === 1
        ? (selected[0] as string)
        : `${selected[0]} +${selected.length - 1}`;

  const toggle = (o: string) =>
    onChange(selected.includes(o) ? selected.filter((s) => s !== o) : [...selected, o]);

  return (
    <Popover onOpenChange={(open) => !open && setNeedle("")}>
      <ChipTrigger field={cfg.field} label={label} summary={summary} onClear={onClear} />
      <PopoverContent className="udc:w-60 udc:p-2" data-testid={`chip-panel-${cfg.field}`}>
        {options.length > 8 ? (
          <Input
            autoFocus
            value={needle}
            onChange={(e) => setNeedle(e.target.value)}
            placeholder={t("APP", "OPTIONS_FILTER")}
            className="udc:mb-2 udc:h-7 udc:text-xs"
          />
        ) : null}
        <div className="udc-scroll-thin udc:-mx-1 udc:max-h-64 udc:overflow-y-auto udc:px-1">
          {shown.map((o) => (
            // biome-ignore lint/a11y/noLabelWithoutControl: the Radix checkbox inside is the control
            <label
              key={o}
              data-testid={`chip-option-${o}`}
              className="udc:flex udc:h-7 udc:cursor-pointer udc:items-center udc:gap-2 udc:rounded-md udc:px-1.5 udc:text-[13px] udc:hover:bg-hover"
            >
              <Checkbox checked={selected.includes(o)} onCheckedChange={() => toggle(o)} />
              <span className="udc:truncate">{o}</span>
            </label>
          ))}
        </div>
        {selected.length ? (
          <div className="udc:mt-2 udc:flex udc:items-center udc:justify-between udc:border-t udc:border-border udc:pt-2 udc:text-xs udc:text-muted-foreground">
            <span>{t("APP", "SELECTED_N", { n: selected.length })}</span>
            <Button size="sm" variant="ghost" onClick={onClear}>
              {t("APP", "CLEAR")}
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function RangeChip({
  cfg,
  label,
  value,
  onChange,
  onClear,
}: {
  cfg: FilterChipConfig;
  label: string;
  value: { min: number | null; max: number | null } | undefined;
  onChange: (min: number | null, max: number | null) => void;
  onClear: () => void;
}) {
  const { Button, Input, Popover, PopoverContent } = useUiKit();
  const { t, intlLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const [lo, setLo] = useState("");
  const [hi, setHi] = useState("");

  useEffect(() => {
    if (open) {
      setLo(value?.min == null ? "" : String(value.min));
      setHi(value?.max == null ? "" : String(value.max));
    }
  }, [open, value?.min, value?.max]);

  const fmt = (n: number) => new Intl.NumberFormat(intlLocale).format(n);
  const summary = !value
    ? null
    : value.min !== null && value.max !== null
      ? `${fmt(value.min)}–${fmt(value.max)}`
      : value.min !== null
        ? `≥ ${fmt(value.min)}`
        : `≤ ${fmt(value.max ?? 0)}`;

  const num = (s: string) => (s.trim() === "" || !Number.isFinite(Number(s)) ? null : Number(s));
  const apply = () => {
    onChange(num(lo), num(hi));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <ChipTrigger field={cfg.field} label={label} summary={summary} onClear={onClear} />
      <PopoverContent className="udc:w-64" data-testid={`chip-panel-${cfg.field}`}>
        <ChipPanel title={label}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              apply();
            }}
          >
            <div className="udc:flex udc:items-center udc:gap-2">
              <Input
                type="number"
                autoFocus
                aria-label={t("APP", "MIN")}
                data-testid={`chip-min-${cfg.field}`}
                placeholder={cfg.min === undefined ? t("APP", "MIN") : String(cfg.min)}
                min={cfg.min}
                max={cfg.max}
                step={cfg.step}
                value={lo}
                onChange={(e) => setLo(e.target.value)}
              />
              <span className="udc:text-muted-foreground">–</span>
              <Input
                type="number"
                aria-label={t("APP", "MAX")}
                data-testid={`chip-max-${cfg.field}`}
                placeholder={cfg.max === undefined ? t("APP", "MAX") : String(cfg.max)}
                min={cfg.min}
                max={cfg.max}
                step={cfg.step}
                value={hi}
                onChange={(e) => setHi(e.target.value)}
              />
            </div>
            <div className="udc:mt-3 udc:flex udc:justify-end udc:gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  onClear();
                  setOpen(false);
                }}
              >
                {t("APP", "CLEAR")}
              </Button>
              <Button size="sm" variant="primary" type="submit" data-testid="chip-apply">
                {t("APP", "APPLY")}
              </Button>
            </div>
          </form>
        </ChipPanel>
      </PopoverContent>
    </Popover>
  );
}

function BoolChip({
  cfg,
  label,
  value,
  onChange,
  onClear,
}: {
  cfg: FilterChipConfig;
  label: string;
  value: { value: boolean } | undefined;
  onChange: (v: boolean | null) => void;
  onClear: () => void;
}) {
  const { Popover, PopoverContent } = useUiKit();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const current = value === undefined ? null : value.value;
  const choices: { v: boolean | null; label: string; id: string }[] = [
    { v: null, label: t("APP", "ANY"), id: "any" },
    { v: true, label: t("APP", "YES"), id: "true" },
    { v: false, label: t("APP", "NO"), id: "false" },
  ];
  const summary = current === null ? null : current ? t("APP", "YES") : t("APP", "NO");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <ChipTrigger field={cfg.field} label={label} summary={summary} onClear={onClear} />
      <PopoverContent className="udc:w-44 udc:p-1" data-testid={`chip-panel-${cfg.field}`}>
        <div>
          {choices.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={current === c.v}
              data-testid={`chip-option-${c.id}`}
              onClick={() => {
                onChange(c.v);
                setOpen(false);
              }}
              className="udc:flex udc:h-7 udc:w-full udc:items-center udc:gap-2 udc:rounded-md udc:px-2 udc:text-left udc:text-[13px] udc:outline-none udc:hover:bg-hover udc:focus-visible:bg-hover"
            >
              <span className="udc:grid udc:size-4 udc:place-items-center">
                {current === c.v ? <Check className="udc:size-3.5 udc:text-primary" /> : null}
              </span>
              {c.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function defaultChipLabel(cfg: FilterChipConfig): string {
  return cfg.label ?? humanize(cfg.field);
}
