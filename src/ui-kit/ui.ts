// @jsudc/react/ui: the default UI kit and the primitives it is built from
// (Radix + Tailwind). `defaultUiKit` is what the renderers draw with when no
// other kit is provided; the primitives are here for a host that wants the
// same Button or Dialog on its own pages.

export { Button, type ButtonProps } from "../components/ui/button.js";
export { Checkbox } from "../components/ui/checkbox.js";
export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from "../components/ui/dialog.js";
export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu.js";
export { Input, inputClass, NativeSelect } from "../components/ui/input.js";
export { Kbd, Skeleton, Spinner } from "../components/ui/misc.js";
export {
  Popover,
  PopoverAnchor,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover.js";
export { Segmented, type SegmentedOption } from "../components/ui/segmented.js";
export { Select, type SelectOption } from "../components/ui/select.js";
export { Toaster, type ToastInput, type ToastVariant, useToast } from "../components/ui/toast.js";
export { Tip, TooltipProvider } from "../components/ui/tooltip.js";
export { defaultUiKit } from "./default.js";
