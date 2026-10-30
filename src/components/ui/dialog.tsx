import { X } from "lucide-react";
import { Dialog as D } from "radix-ui";
import { type ComponentProps, forwardRef, type ReactNode } from "react";
import { cn } from "../../lib/utils.js";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

/** A centred Radix dialog over a dimmed backdrop, with a title row and a close button. */
export const DialogContent = forwardRef<
  HTMLDivElement,
  // The HTML `title` attribute is dropped: here it is the heading, any node.
  Omit<ComponentProps<typeof D.Content>, "title"> & { title: ReactNode; description?: ReactNode }
>(function DialogContent({ className, title, description, children, ...props }, ref) {
  return (
    <D.Portal>
      <D.Overlay className="udc:fixed udc:inset-0 udc:z-50 udc:bg-black/35 udc:data-[state=open]:animate-[overlay-in_140ms_ease-out] udc:dark:bg-black/55" />
      <D.Content
        ref={ref}
        className={cn(
          "udc:fixed udc:top-[12vh] udc:left-1/2 udc:z-50 udc:flex udc:max-h-[80vh] udc:w-[calc(100vw-2rem)] udc:max-w-md udc:-translate-x-1/2 udc:flex-col udc:rounded-xl udc:border udc:border-border udc:bg-surface-raised udc:text-foreground udc:shadow-2xl udc:shadow-black/15 udc:outline-none",
          "udc:data-[state=open]:animate-in udc:dark:shadow-black/50",
          className,
        )}
        {...(description ? {} : { "aria-describedby": undefined })}
        {...props}
      >
        <div className="udc:flex udc:items-start udc:gap-3 udc:px-5 udc:pt-4 udc:pb-3">
          <div className="udc:min-w-0 udc:flex-1">
            <D.Title className="udc:text-[15px] udc:font-semibold udc:tracking-tight">
              {title}
            </D.Title>
            {description ? (
              <D.Description className="udc:mt-1 udc:text-[13px] udc:text-muted-foreground">
                {description}
              </D.Description>
            ) : null}
          </div>
          <D.Close
            aria-label="Close"
            className="udc:-mr-1.5 udc:rounded-md udc:p-1 udc:text-muted-foreground udc:outline-none udc:hover:bg-hover udc:hover:text-foreground udc:focus-visible:ring-2 udc:focus-visible:ring-ring"
          >
            <X className="udc:size-4" />
          </D.Close>
        </div>
        {children}
      </D.Content>
    </D.Portal>
  );
});

/** The scrolling middle of a dialog. */
export function DialogBody({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("udc-scroll-thin udc:min-h-0 udc:overflow-y-auto udc:px-5 udc:pb-4", className)}
      {...props}
    />
  );
}

/** The button row at the bottom of a dialog. */
export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "udc:flex udc:items-center udc:justify-end udc:gap-2 udc:rounded-b-xl udc:border-t udc:border-border udc:bg-muted/50 udc:px-5 udc:py-3",
        className,
      )}
      {...props}
    />
  );
}
