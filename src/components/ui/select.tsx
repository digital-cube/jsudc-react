import { Check, ChevronDown } from "lucide-react";
import { Select as S } from "radix-ui";
import { cn } from "../../lib/utils";
import type { SelectOption } from "../../ui-kit/types";

export type { SelectOption };

/** A Radix select with the input look. `value` must not be "" (Radix reserves it). */
export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  className,
  "aria-label": ariaLabel,
  "data-testid": testId,
}: {
  value: string | undefined;
  onValueChange: (v: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
  "data-testid"?: string;
}) {
  return (
    <S.Root {...(value ? { value } : {})} onValueChange={onValueChange}>
      <S.Trigger
        aria-label={ariaLabel}
        data-testid={testId}
        className={cn(
          "udc:inline-flex udc:h-8 udc:w-full udc:min-w-0 udc:items-center udc:justify-between udc:gap-1 udc:rounded-md udc:border udc:border-input udc:bg-surface udc:px-2.5 udc:text-left udc:text-[13px] udc:shadow-xs",
          "udc:focus-visible:border-ring udc:focus-visible:outline-none udc:focus-visible:ring-3 udc:focus-visible:ring-ring/20",
          "udc:data-[placeholder]:text-muted-foreground",
          className,
        )}
      >
        <span className="udc:truncate">
          <S.Value placeholder={placeholder} />
        </span>
        <S.Icon>
          <ChevronDown className="udc:size-3.5 udc:opacity-60" />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content
          position="popper"
          sideOffset={4}
          className="udc:z-[60] udc:max-h-72 udc:min-w-[var(--radix-select-trigger-width)] udc:overflow-hidden udc:rounded-lg udc:border udc:border-border udc:bg-surface-raised udc:shadow-lg udc:shadow-black/5 udc:data-[state=open]:animate-in udc:dark:shadow-black/40"
        >
          <S.Viewport className="udc-scroll-thin udc:p-1">
            {options.map((o) => (
              <S.Item
                key={o.value}
                value={o.value}
                className="udc:relative udc:flex udc:h-7 udc:cursor-default udc:select-none udc:items-center udc:rounded-md udc:pr-2 udc:pl-7 udc:text-[13px] udc:outline-none udc:data-[highlighted]:bg-hover udc:data-[state=checked]:font-medium"
              >
                <S.ItemIndicator className="udc:absolute udc:left-2 udc:inline-flex">
                  <Check className="udc:size-3.5 udc:text-primary" />
                </S.ItemIndicator>
                <S.ItemText>{o.label}</S.ItemText>
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}
