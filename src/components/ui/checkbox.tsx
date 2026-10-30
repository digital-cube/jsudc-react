import { Check, Minus } from "lucide-react";
import { Checkbox as C } from "radix-ui";
import { type ComponentProps, forwardRef } from "react";
import { cn } from "../../lib/utils.js";

export const Checkbox = forwardRef<HTMLButtonElement, ComponentProps<typeof C.Root>>(
  function Checkbox({ className, ...props }, ref) {
    return (
      <C.Root
        ref={ref}
        className={cn(
          "udc:peer udc:grid udc:size-4 udc:shrink-0 udc:place-items-center udc:rounded-[4px] udc:border udc:border-border-strong udc:bg-surface udc:shadow-xs udc:transition-colors",
          "udc:focus-visible:outline-none udc:focus-visible:ring-2 udc:focus-visible:ring-ring udc:focus-visible:ring-offset-1 udc:focus-visible:ring-offset-background",
          "udc:data-[state=checked]:border-primary udc:data-[state=checked]:bg-primary udc:data-[state=checked]:text-primary-foreground",
          "udc:data-[state=indeterminate]:border-primary udc:data-[state=indeterminate]:bg-primary udc:data-[state=indeterminate]:text-primary-foreground",
          className,
        )}
        {...props}
      >
        <C.Indicator>
          {props.checked === "indeterminate" ? (
            <Minus className="udc:size-3" strokeWidth={3} />
          ) : (
            <Check className="udc:size-3" strokeWidth={3} />
          )}
        </C.Indicator>
      </C.Root>
    );
  },
);
