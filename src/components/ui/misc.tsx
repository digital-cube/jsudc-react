import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("udc-skeleton udc:rounded", className)} {...props} />;
}

export function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "udc:inline-flex udc:h-5 udc:items-center udc:rounded udc:border udc:border-border udc:bg-muted udc:px-1.5 udc:font-mono udc:text-[10px] udc:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "udc:inline-block udc:size-3.5 udc:animate-spin udc:rounded-full udc:border-2 udc:border-current udc:border-r-transparent",
        className,
      )}
    />
  );
}
