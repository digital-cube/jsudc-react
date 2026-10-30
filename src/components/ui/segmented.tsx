import { ToggleGroup } from "radix-ui";
import { cn } from "../../lib/utils.js";
import type { SegmentedOption } from "../../ui-kit/types.js";
import { Tip } from "./tooltip.js";

export type { SegmentedOption };

/** A single-choice segmented control (pages | infinite, table | cards, en | sr). */
export function Segmented<V extends string>({
  value,
  onChange,
  options,
  "aria-label": ariaLabel,
  className,
  "data-testid": testId,
}: {
  value: V;
  onChange: (v: V) => void;
  options: readonly SegmentedOption<V>[];
  "aria-label": string;
  className?: string;
  "data-testid"?: string;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as V)}
      aria-label={ariaLabel}
      data-testid={testId}
      className={cn(
        "udc:inline-flex udc:h-8 udc:items-center udc:gap-0.5 udc:rounded-md udc:bg-muted udc:p-0.5",
        className,
      )}
    >
      {options.map((o) => {
        const item = (
          <ToggleGroup.Item
            key={o.value}
            value={o.value}
            data-testid={o.testId}
            disabled={o.disabled}
            className={cn(
              "udc:inline-flex udc:h-7 udc:items-center udc:gap-1.5 udc:rounded-[5px] udc:px-2.5 udc:text-xs udc:font-medium udc:text-muted-foreground udc:transition-colors",
              "udc:hover:text-foreground udc:focus-visible:outline-none udc:focus-visible:ring-2 udc:focus-visible:ring-ring",
              "udc:data-[state=on]:bg-surface udc:data-[state=on]:text-foreground udc:data-[state=on]:shadow-sm",
              "udc:disabled:pointer-events-none udc:disabled:opacity-45",
              "udc:[&_svg]:size-3.5",
            )}
          >
            {o.label}
          </ToggleGroup.Item>
        );
        // A disabled button gets no pointer events: the tooltip hangs on a wrapper.
        return o.tooltip ? (
          <Tip key={o.value} label={o.tooltip}>
            <span className="udc:inline-flex">{item}</span>
          </Tip>
        ) : (
          item
        );
      })}
    </ToggleGroup.Root>
  );
}
