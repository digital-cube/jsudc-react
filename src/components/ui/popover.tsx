import { Popover as P } from "radix-ui";
import { type ComponentProps, forwardRef } from "react";
import { cn } from "../../lib/utils.js";

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverClose = P.Close;
export const PopoverAnchor = P.Anchor;

export const PopoverContent = forwardRef<HTMLDivElement, ComponentProps<typeof P.Content>>(
  function PopoverContent({ className, align = "start", sideOffset = 6, ...props }, ref) {
    return (
      <P.Portal>
        <P.Content
          ref={ref}
          align={align}
          sideOffset={sideOffset}
          className={cn(
            "udc:z-50 udc:rounded-lg udc:border udc:border-border udc:bg-surface-raised udc:p-3 udc:text-foreground udc:shadow-lg udc:shadow-black/5 udc:outline-none",
            "udc:data-[state=open]:animate-in udc:dark:shadow-black/40",
            className,
          )}
          {...props}
        />
      </P.Portal>
    );
  },
);
