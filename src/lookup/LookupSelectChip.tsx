import type { FilterChipConfig, LookupDef } from "@jsudc/core";
import { useState } from "react";
import { ChipTrigger } from "../data-view/FilterChips.js";
import { useI18n } from "../i18n/i18n.js";
import { useUiKit } from "../ui-kit/context.js";
import { lookupLabel } from "./label.js";
import { LOOKUP_OPTIONS_LIMIT, useLookupOptions } from "./options.js";
import { useUdcLookup } from "./useUdcLookup.js";

/**
 * A `select` chip over a lookup field: its options are the target's rows,
 * shown by `label_field` and stored by key. Up to `LOOKUP_OPTIONS_LIMIT`
 * rows are listed as they are; a larger target gets a search box that asks
 * the server (`contains` on `label_field`).
 */
export function LookupSelectChip({
  cfg,
  lookup,
  label,
  value,
  onChange,
  onClear,
}: {
  cfg: FilterChipConfig;
  lookup: LookupDef;
  label: string;
  value: { values: string[] } | undefined;
  onChange: (values: string[]) => void;
  onClear: () => void;
}) {
  const { Button, Checkbox, Input, Popover, PopoverContent, Spinner } = useUiKit();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [needle, setNeedle] = useState("");
  const selected = value?.values ?? [];
  const all = useLookupOptions(lookup, "", { enabled: open });
  const searchable = (all.total ?? 0) > LOOKUP_OPTIONS_LIMIT;
  const found = useLookupOptions(lookup, needle, { enabled: open && searchable && needle !== "" });
  const shown = searchable && needle ? found : all;
  // The labels of what is selected, for the summary (the options may not hold them).
  const picked = useUdcLookup(lookup, selected);
  const name = (key: string) => lookupLabel(picked.row(key), lookup) ?? key;
  const summary =
    selected.length === 0
      ? null
      : selected.length === 1
        ? name(selected[0] as string)
        : `${name(selected[0] as string)} +${selected.length - 1}`;

  const toggle = (k: string) =>
    onChange(selected.includes(k) ? selected.filter((s) => s !== k) : [...selected, k]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setNeedle("");
      }}
    >
      <ChipTrigger field={cfg.field} label={label} summary={summary} onClear={onClear} />
      <PopoverContent className="udc:w-64 udc:p-2" data-testid={`chip-panel-${cfg.field}`}>
        {searchable ? (
          <Input
            autoFocus
            value={needle}
            onChange={(e) => setNeedle(e.target.value)}
            placeholder={t("APP", "LOOKUP_SEARCH")}
            data-testid={`chip-search-${cfg.field}`}
            className="udc:mb-2 udc:h-7 udc:text-xs"
          />
        ) : null}
        <div className="udc-scroll-thin udc:-mx-1 udc:max-h-64 udc:overflow-y-auto udc:px-1">
          {shown.isLoading ? (
            <div className="udc:flex udc:h-10 udc:items-center udc:justify-center">
              <Spinner />
            </div>
          ) : (
            shown.options.map((o) => (
              // biome-ignore lint/a11y/noLabelWithoutControl: the Radix checkbox inside is the control
              <label
                key={o.key}
                data-testid={`chip-option-${o.key}`}
                data-label={o.label}
                className="udc:flex udc:h-7 udc:cursor-pointer udc:items-center udc:gap-2 udc:rounded-md udc:px-1.5 udc:text-[13px] udc:hover:bg-hover"
              >
                <Checkbox
                  checked={selected.includes(o.key)}
                  onCheckedChange={() => toggle(o.key)}
                />
                <span className="udc:truncate">{o.label}</span>
              </label>
            ))
          )}
          {!shown.isLoading && shown.options.length === 0 ? (
            <div className="udc:px-1.5 udc:py-2 udc:text-xs udc:text-muted-foreground">
              {t("APP", "LOOKUP_NO_MATCH")}
            </div>
          ) : null}
          {searchable && !needle ? (
            <div className="udc:px-1.5 udc:pt-1 udc:text-[11px] udc:text-muted-foreground">
              {t("APP", "LOOKUP_MORE", { n: (all.total ?? 0) - all.options.length })}
            </div>
          ) : null}
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
