import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { Toast as T } from "radix-ui";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { cn } from "../../lib/utils";
import type { ToastInput, ToastVariant } from "../../ui-kit/types";

export type { ToastInput, ToastVariant };

interface ToastItem extends ToastInput {
  id: number;
}

const ToastContext = createContext<((t: ToastInput) => void) | null>(null);

const ICON: Record<ToastVariant, ReactNode> = {
  info: <Info className="udc:size-4 udc:text-sem-info" />,
  success: <CheckCircle2 className="udc:size-4 udc:text-sem-success" />,
  warning: <AlertTriangle className="udc:size-4 udc:text-sem-warning" />,
  danger: <AlertTriangle className="udc:size-4 udc:text-sem-danger" />,
};

let nextId = 1;

/** Radix toasts, stacked bottom-right. `useToast()` returns the function that shows one. */
export function Toaster({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const show = useCallback((t: ToastInput) => {
    const id = nextId++;
    setItems((prev) => [...prev.slice(-3), { ...t, id }]);
  }, []);
  const remove = (id: number) => setItems((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={show}>
      <T.Provider swipeDirection="right" duration={6000}>
        {children}
        {items.map((t) => (
          <T.Root
            key={t.id}
            data-testid="toast"
            data-variant={t.variant ?? "info"}
            onOpenChange={(open) => !open && remove(t.id)}
            className={cn(
              "udc:grid udc:grid-cols-[auto_1fr_auto] udc:items-start udc:gap-3 udc:rounded-lg udc:border udc:border-border udc:bg-surface-raised udc:p-3 udc:pr-2 udc:shadow-lg udc:shadow-black/10 udc:dark:shadow-black/40",
              "udc:data-[state=open]:animate-in udc:data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]",
            )}
          >
            <span className="udc:mt-0.5">{ICON[t.variant ?? "info"]}</span>
            <div className="udc:min-w-0">
              <T.Title className="udc:text-[13px] udc:font-semibold">{t.title}</T.Title>
              {t.description ? (
                <T.Description className="udc:mt-0.5 udc:text-xs udc:text-muted-foreground">
                  {t.description}
                </T.Description>
              ) : null}
            </div>
            <T.Close
              aria-label="Close"
              className="udc:rounded udc:p-1 udc:text-muted-foreground udc:hover:bg-hover udc:hover:text-foreground"
            >
              <X className="udc:size-3.5" />
            </T.Close>
          </T.Root>
        ))}
        <T.Viewport className="udc:fixed udc:right-0 udc:bottom-0 udc:z-[100] udc:m-0 udc:flex udc:w-[380px] udc:max-w-[100vw] udc:list-none udc:flex-col udc:gap-2 udc:p-4 udc:outline-none" />
      </T.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast needs a <Toaster> above it");
  return useMemo(() => ({ toast: show }), [show]);
}
