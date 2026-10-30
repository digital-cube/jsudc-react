import { Tooltip as T } from "radix-ui";
import type { ReactNode } from "react";

export const TooltipProvider = T.Provider;

/** A hover / focus label for an icon button. */
export function Tip({
  label,
  children,
  side = "bottom",
}: {
  label: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          className="udc:z-50 udc:rounded-md udc:bg-foreground udc:px-2 udc:py-1 udc:text-xs udc:font-medium udc:text-background udc:shadow-md udc:data-[state=delayed-open]:animate-in"
        >
          {label}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
