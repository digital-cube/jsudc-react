import { DropdownMenu as M } from "radix-ui";
import { type ComponentProps, forwardRef } from "react";
import { cn } from "../../lib/utils.js";

export const DropdownMenu = M.Root;
export const DropdownMenuTrigger = M.Trigger;

export const DropdownMenuContent = forwardRef<HTMLDivElement, ComponentProps<typeof M.Content>>(
  function DropdownMenuContent({ className, align = "end", sideOffset = 4, ...props }, ref) {
    return (
      <M.Portal>
        <M.Content
          ref={ref}
          align={align}
          sideOffset={sideOffset}
          className={cn(
            "udc:z-50 udc:min-w-48 udc:rounded-lg udc:border udc:border-border udc:bg-surface-raised udc:p-1 udc:text-foreground udc:shadow-lg udc:shadow-black/5 udc:outline-none",
            "udc:data-[state=open]:animate-in udc:dark:shadow-black/40",
            className,
          )}
          {...props}
        />
      </M.Portal>
    );
  },
);

export const DropdownMenuItem = forwardRef<
  HTMLDivElement,
  ComponentProps<typeof M.Item> & { tone?: "default" | "danger" }
>(function DropdownMenuItem({ className, tone = "default", ...props }, ref) {
  return (
    <M.Item
      ref={ref}
      className={cn(
        "udc:flex udc:h-8 udc:cursor-default udc:select-none udc:items-center udc:gap-2 udc:rounded-md udc:px-2 udc:text-[13px] udc:outline-none udc:[&_svg]:size-4 udc:[&_svg]:shrink-0",
        tone === "danger"
          ? "udc:text-sem-danger udc:data-[highlighted]:bg-sem-danger-bg"
          : "udc:data-[highlighted]:bg-hover udc:[&_svg]:text-muted-foreground",
        "udc:data-[disabled]:pointer-events-none udc:data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    />
  );
});

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <M.Separator className={cn("udc:my-1 udc:h-px udc:bg-border", className)} />;
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof M.Label>) {
  return (
    <M.Label
      className={cn(
        "udc:px-2 udc:pt-1.5 udc:pb-1 udc:text-[11px] udc:font-medium udc:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
