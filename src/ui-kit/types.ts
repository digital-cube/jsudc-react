// The UI kit contract: every primitive the renderers draw, typed by the props
// they actually pass and nothing more. The Radix + Tailwind kit in
// `components/ui` is the default implementation (`@jsudc/react/ui`); a host
// hands another one to `UdcUiProvider` (or `UdcProvider kit={…}`).
//
// Kept narrow on purpose: an adapter over MUI, Ant or a host's shadcn copy has
// to implement exactly this, so a prop goes in when a renderer starts using it.

import type {
  ChangeEvent,
  ComponentType,
  CSSProperties,
  FocusEventHandler,
  HTMLInputTypeAttribute,
  KeyboardEventHandler,
  MouseEventHandler,
  PointerEventHandler,
  ReactNode,
  Ref,
  SelectHTMLAttributes,
} from "react";

/** What the renderers put on nearly every primitive. */
interface Base {
  className?: string;
  "data-testid"?: string;
}

/** A cancellable event: the renderers only ever call `preventDefault()` on it. */
export interface PreventableEvent {
  preventDefault(): void;
}

// ---------- Buttons and fields ----------

export type ButtonVariant = "primary" | "outline" | "ghost" | "subtle" | "danger";
export type ButtonSize = "sm" | "md" | "icon" | "icon-sm";

export interface UiButtonProps extends Base {
  /** Default `outline`. */
  variant?: ButtonVariant;
  /** Default `md`; `icon` and `icon-sm` are square. */
  size?: ButtonSize;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  onPointerDown?: PointerEventHandler<HTMLButtonElement>;
  "aria-label"?: string;
  children?: ReactNode;
}

export interface UiInputProps extends Base {
  ref?: Ref<HTMLInputElement>;
  id?: string;
  type?: HTMLInputTypeAttribute;
  value?: string | number;
  defaultValue?: string | number;
  placeholder?: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  readOnly?: boolean;
  autoFocus?: boolean;
  autoComplete?: string;
  spellCheck?: boolean;
  inputMode?: "text" | "numeric" | "decimal" | "search";
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  onPointerDown?: PointerEventHandler<HTMLInputElement>;
}

/** A native `<select>` with `<option>` children: keyboard and test friendly. */
export interface UiNativeSelectProps extends Base {
  id?: string;
  value?: SelectHTMLAttributes<HTMLSelectElement>["value"];
  disabled?: boolean;
  "aria-label"?: string;
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  children?: ReactNode;
}

export interface UiCheckboxProps extends Base {
  id?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean | "indeterminate") => void;
}

export interface SelectOption {
  value: string;
  label: string;
}

/** A single choice from a list. `value` is never "" (Radix reserves it); `undefined` shows the placeholder. */
export interface UiSelectProps extends Base {
  value: string | undefined;
  onValueChange: (v: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  "aria-label"?: string;
}

export interface SegmentedOption<V extends string> {
  value: V;
  label: ReactNode;
  testId?: string;
  /** Shown, not choosable; `tooltip` says why. */
  disabled?: boolean;
  tooltip?: string;
}

/** A single-choice segmented control (pages | infinite, table | cards, en | sr). */
export interface UiSegmentedProps<V extends string> extends Base {
  value: V;
  onChange: (v: V) => void;
  options: readonly SegmentedOption<V>[];
  "aria-label": string;
}

// ---------- Small pieces ----------

export interface UiSkeletonProps extends Base {
  style?: CSSProperties;
}

export interface UiKbdProps {
  className?: string;
  children?: ReactNode;
}

export interface UiSpinnerProps {
  className?: string;
}

// ---------- Dialog ----------

/** A controlled modal dialog. */
export interface UiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: ReactNode;
}

/** The dialog panel: a title row with a close button, then `children` (`DialogBody`, `DialogFooter`). */
export interface UiDialogContentProps extends Base {
  title: ReactNode;
  description?: ReactNode;
  role?: "dialog" | "alertdialog";
  "data-mode"?: string;
  /** `preventDefault()` keeps the dialog open (a save in flight). */
  onEscapeKeyDown?: (e: PreventableEvent) => void;
  onInteractOutside?: (e: PreventableEvent) => void;
  children?: ReactNode;
}

export interface UiBlockProps {
  className?: string;
  children?: ReactNode;
}

// ---------- Menus, popovers, tooltips ----------

/**
 * A trigger renders its own button unless `asChild`: then it merges its
 * behaviour into its single child element, which must forward a ref.
 */
export interface UiTriggerProps extends Base {
  asChild?: boolean;
  "aria-label"?: string;
  children?: ReactNode;
}

/** An uncontrolled menu that opens from its trigger. */
export interface UiDropdownMenuProps {
  /** `false`: the page behind stays interactive while the menu is open. */
  modal?: boolean;
  children?: ReactNode;
}

export interface UiDropdownMenuContentProps extends Base {
  align?: "start" | "center" | "end";
  children?: ReactNode;
}

export interface UiDropdownMenuItemProps extends Base {
  tone?: "default" | "danger";
  disabled?: boolean;
  /** Runs on click or Enter; the menu then closes. */
  onSelect?: () => void;
  children?: ReactNode;
}

/** Controlled when `open` is given, otherwise it toggles from its trigger. */
export interface UiPopoverProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
}

export interface UiPopoverContentProps extends Base {
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  collisionPadding?: number;
  "data-event-id"?: string;
  /** `preventDefault()` keeps the focus where it was. */
  onOpenAutoFocus?: (e: PreventableEvent) => void;
  children?: ReactNode;
}

/** Positions the popover at an element that is not its trigger (a calendar event). */
export interface UiPopoverAnchorProps {
  virtualRef: { current: { getBoundingClientRect(): DOMRect } };
}

/** A hover / focus label on its single child, which must forward a ref. */
export interface UiTipProps {
  label: ReactNode;
  children: ReactNode;
}

// ---------- Toasts ----------

export type ToastVariant = "info" | "success" | "warning" | "danger";

export interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
}

// ---------- The kit ----------

/**
 * Every primitive the renderers draw. Hand one to `UdcUiProvider kit={…}` (or
 * `UdcProvider kit={…}`); without a provider the renderers use `defaultUiKit`
 * from `@jsudc/react/ui`. A kit is read once per render, so keep the object
 * stable (a module constant), and `useToast` is called as a hook.
 */
export interface UiKit {
  Button: ComponentType<UiButtonProps>;
  Input: ComponentType<UiInputProps>;
  NativeSelect: ComponentType<UiNativeSelectProps>;
  Checkbox: ComponentType<UiCheckboxProps>;
  Select: ComponentType<UiSelectProps>;
  Segmented: <V extends string>(props: UiSegmentedProps<V>) => ReactNode;
  Spinner: ComponentType<UiSpinnerProps>;
  Skeleton: ComponentType<UiSkeletonProps>;
  Kbd: ComponentType<UiKbdProps>;

  Dialog: ComponentType<UiDialogProps>;
  DialogContent: ComponentType<UiDialogContentProps>;
  /** The scrolling middle of a dialog. */
  DialogBody: ComponentType<UiBlockProps>;
  /** The button row at the bottom of a dialog. */
  DialogFooter: ComponentType<UiBlockProps>;

  DropdownMenu: ComponentType<UiDropdownMenuProps>;
  DropdownMenuTrigger: ComponentType<UiTriggerProps>;
  DropdownMenuContent: ComponentType<UiDropdownMenuContentProps>;
  DropdownMenuItem: ComponentType<UiDropdownMenuItemProps>;
  DropdownMenuLabel: ComponentType<UiBlockProps>;
  DropdownMenuSeparator: ComponentType<{ className?: string }>;

  Popover: ComponentType<UiPopoverProps>;
  PopoverTrigger: ComponentType<UiTriggerProps>;
  PopoverContent: ComponentType<UiPopoverContentProps>;
  PopoverAnchor: ComponentType<UiPopoverAnchorProps>;

  /** Mounted once by the host around the view; `Tip` may need it. */
  TooltipProvider: ComponentType<{ children: ReactNode }>;
  Tip: ComponentType<UiTipProps>;

  /** Mounted once by the host around the view: the toast stack and its viewport. */
  Toaster: ComponentType<{ children: ReactNode }>;
  /** A hook: returns the function that shows a toast. */
  useToast: () => { toast: (t: ToastInput) => void };
}
