// The smallest UiKit: plain HTML elements, no Radix, no Tailwind. Every element
// it draws carries `data-kit="stub"`, so a test can tell it from the default
// kit. It is also the README's example of bringing your own primitives.

import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ToastInput, UiKit, UiTriggerProps } from "../src";

const stub = (name: string) => ({ "data-kit": "stub", "data-stub": name });

// Plain HTML, but what floats has to sit above the table's sticky header.
const floating = { position: "absolute", zIndex: 50, background: "white" } as const;

interface Open {
  open: boolean;
  setOpen: (open: boolean) => void;
}
const PopoverCtx = createContext<Open>({ open: false, setOpen: () => {} });
const MenuCtx = createContext<Open>({ open: false, setOpen: () => {} });
const DialogCtx = createContext<Open>({ open: false, setOpen: () => {} });

/** Open state that is controlled when `open` is given. */
function useOpen(open: boolean | undefined, onOpenChange?: (open: boolean) => void): Open {
  const [own, setOwn] = useState(false);
  const setOpen = useCallback(
    (next: boolean) => {
      if (open === undefined) setOwn(next);
      onOpenChange?.(next);
    },
    [open, onOpenChange],
  );
  return useMemo(() => ({ open: open ?? own, setOpen }), [open, own, setOpen]);
}

/** A trigger: its own button, or (`asChild`) the click merged into its single child. */
function trigger(name: string, ctx: Open, { asChild, children, ...props }: UiTriggerProps) {
  const toggle = () => ctx.setOpen(!ctx.open);
  const child = Children.only(children);
  if (asChild && isValidElement(child)) {
    const el = child as ReactElement<{ onClick?: (e: MouseEvent) => void }>;
    return cloneElement(el, {
      ...stub(name),
      "aria-expanded": ctx.open,
      onClick: (e: MouseEvent) => {
        el.props.onClick?.(e);
        toggle();
      },
    } as object);
  }
  return (
    <button type="button" {...stub(name)} {...props} aria-expanded={ctx.open} onClick={toggle}>
      {children}
    </button>
  );
}

const ToastCtx = createContext<((t: ToastInput) => void) | null>(null);

function Toaster({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<(ToastInput & { id: number })[]>([]);
  const toast = useCallback((t: ToastInput) => setItems((p) => [...p, { ...t, id: p.length }]), []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <output {...stub("Toaster")}>
        {items.map((t) => (
          <div key={t.id} data-testid="toast" data-variant={t.variant ?? "info"}>
            <strong>{t.title}</strong> {t.description}
          </div>
        ))}
      </output>
    </ToastCtx.Provider>
  );
}

export const stubKit: UiKit = {
  Button: ({ variant, size, type, ...props }) => (
    <button
      {...stub("Button")}
      data-variant={variant}
      data-size={size}
      type={type ?? "button"}
      {...props}
    />
  ),
  Input: (props) => <input {...stub("Input")} {...props} />,
  NativeSelect: (props) => <select {...stub("NativeSelect")} {...props} />,
  Checkbox: ({ onCheckedChange, ...props }) => (
    <input
      type="checkbox"
      {...stub("Checkbox")}
      {...props}
      onChange={(e) => onCheckedChange(e.target.checked)}
    />
  ),
  Select: ({ value, onValueChange, options, placeholder, ...props }) => (
    <select
      {...stub("Select")}
      {...props}
      value={value ?? ""}
      onChange={(e) => onValueChange(e.target.value)}
    >
      <option value="" disabled>
        {placeholder ?? ""}
      </option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
  Segmented: ({ value, onChange, options, ...props }) => (
    <fieldset {...stub("Segmented")} {...props}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          data-testid={o.testId}
          aria-pressed={o.value === value}
          data-state={o.value === value ? "on" : "off"}
          disabled={o.disabled}
          title={o.tooltip}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </fieldset>
  ),
  Spinner: ({ className }) => <span aria-hidden {...stub("Spinner")} className={className} />,
  Skeleton: (props) => <div {...stub("Skeleton")} {...props} />,
  Kbd: (props) => <kbd {...stub("Kbd")} {...props} />,

  Dialog: ({ open, onOpenChange, children }) => (
    <DialogCtx.Provider value={{ open, setOpen: onOpenChange }}>{children}</DialogCtx.Provider>
  ),
  DialogContent: function DialogContent({
    title,
    description,
    onEscapeKeyDown,
    onInteractOutside: _outside,
    children,
    ...props
  }) {
    const { open, setOpen } = useContext(DialogCtx);
    if (!open) return null;
    return (
      <dialog
        open
        aria-modal
        style={floating}
        {...stub("DialogContent")}
        {...props}
        onKeyDown={(e) => {
          if (e.key !== "Escape") return;
          onEscapeKeyDown?.(e);
          if (!e.isDefaultPrevented()) setOpen(false);
        }}
      >
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
        <button type="button" aria-label="Close" onClick={() => setOpen(false)}>
          ×
        </button>
        {children}
      </dialog>
    );
  },
  DialogBody: (props) => <div {...stub("DialogBody")} {...props} />,
  DialogFooter: (props) => <footer {...stub("DialogFooter")} {...props} />,

  DropdownMenu: function DropdownMenu({ children }) {
    return <MenuCtx.Provider value={useOpen(undefined)}>{children}</MenuCtx.Provider>;
  },
  DropdownMenuTrigger: function DropdownMenuTrigger(props) {
    return trigger("DropdownMenuTrigger", useContext(MenuCtx), props);
  },
  DropdownMenuContent: function DropdownMenuContent({ align: _align, ...props }) {
    return useContext(MenuCtx).open ? (
      <div role="menu" style={floating} {...stub("DropdownMenuContent")} {...props} />
    ) : null;
  },
  DropdownMenuItem: function DropdownMenuItem({ tone, onSelect, ...props }) {
    const { setOpen } = useContext(MenuCtx);
    return (
      <button
        type="button"
        role="menuitem"
        {...stub("DropdownMenuItem")}
        data-tone={tone}
        {...props}
        onClick={() => {
          onSelect?.();
          setOpen(false);
        }}
      />
    );
  },
  DropdownMenuLabel: (props) => <div {...stub("DropdownMenuLabel")} {...props} />,
  DropdownMenuSeparator: ({ className }) => (
    <hr {...stub("DropdownMenuSeparator")} className={className} />
  ),

  Popover: function Popover({ open, onOpenChange, children }) {
    return (
      <PopoverCtx.Provider value={useOpen(open, onOpenChange)}>{children}</PopoverCtx.Provider>
    );
  },
  PopoverTrigger: function PopoverTrigger(props) {
    return trigger("PopoverTrigger", useContext(PopoverCtx), props);
  },
  PopoverContent: function PopoverContent({
    side: _side,
    align: _align,
    collisionPadding: _padding,
    onOpenAutoFocus: _focus,
    ...props
  }) {
    const { open, setOpen } = useContext(PopoverCtx);
    if (!open) return null;
    return (
      <dialog
        open
        style={floating}
        {...stub("PopoverContent")}
        {...props}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      />
    );
  },
  PopoverAnchor: () => null,

  TooltipProvider: ({ children }) => children,
  Tip: ({ label, children }) => (
    <span {...stub("Tip")} title={typeof label === "string" ? label : undefined}>
      {children}
    </span>
  ),

  Toaster,
  useToast: () => {
    const toast = useContext(ToastCtx);
    if (!toast) throw new Error("useToast needs the stub kit's <Toaster> above it");
    return { toast };
  },
};
