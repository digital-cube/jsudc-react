import { Slot } from "radix-ui";
import { type ComponentProps, forwardRef } from "react";
import { cn } from "../../lib/utils";

const VARIANTS = {
  primary:
    "udc:bg-primary udc:text-primary-foreground udc:shadow-sm udc:hover:bg-primary/90 udc:disabled:bg-primary/50",
  outline:
    "udc:border udc:border-border-strong/80 udc:bg-surface udc:text-foreground udc:shadow-xs udc:hover:bg-hover udc:hover:border-border-strong",
  ghost: "udc:text-muted-foreground udc:hover:bg-hover udc:hover:text-foreground",
  subtle: "udc:bg-muted udc:text-foreground udc:hover:bg-selected",
  danger:
    "udc:bg-sem-danger udc:text-white udc:shadow-sm udc:hover:bg-sem-danger/90 udc:disabled:bg-sem-danger/50 udc:dark:text-background",
} as const;

const SIZES = {
  sm: "udc:h-7 udc:gap-1.5 udc:rounded-md udc:px-2.5 udc:text-xs",
  md: "udc:h-8 udc:gap-2 udc:rounded-md udc:px-3 udc:text-[13px]",
  icon: "udc:size-8 udc:rounded-md",
  "icon-sm": "udc:size-7 udc:rounded-md",
} as const;

export type ButtonProps = ComponentProps<"button"> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  asChild?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "outline", size = "md", asChild, className, type, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : (type ?? "button")}
      className={cn(
        "udc:inline-flex udc:shrink-0 udc:select-none udc:items-center udc:justify-center udc:whitespace-nowrap udc:font-medium udc:transition-colors",
        "udc:focus-visible:outline-none udc:focus-visible:ring-2 udc:focus-visible:ring-ring udc:focus-visible:ring-offset-1 udc:focus-visible:ring-offset-background",
        "udc:disabled:pointer-events-none udc:disabled:opacity-50 udc:[&_svg]:size-4 udc:[&_svg]:shrink-0",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
});
