// @jsudc/react/ui: the default UI kit and the primitives it is built from
// (Radix + Tailwind). `defaultUiKit` is what the renderers draw with when no
// other kit is provided; the primitives are here for a host that wants the
// same Button or Dialog on its own pages.

export { Button, type ButtonProps } from "../components/ui/button";
export { Checkbox } from "../components/ui/checkbox";
export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from "../components/ui/dialog";
export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
export { Input, inputClass, NativeSelect } from "../components/ui/input";
export { Kbd, Skeleton, Spinner } from "../components/ui/misc";
export {
  Popover,
  PopoverAnchor,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover";
export { Segmented, type SegmentedOption } from "../components/ui/segmented";
export { Select, type SelectOption } from "../components/ui/select";
export { Toaster, type ToastInput, type ToastVariant, useToast } from "../components/ui/toast";
export { Tip, TooltipProvider } from "../components/ui/tooltip";
export { defaultUiKit } from "./default";
