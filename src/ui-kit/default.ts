import { Button } from "../components/ui/button.js";
import { Checkbox } from "../components/ui/checkbox.js";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "../components/ui/dialog.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu.js";
import { Input, NativeSelect } from "../components/ui/input.js";
import { Kbd, Skeleton, Spinner } from "../components/ui/misc.js";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover.js";
import { Segmented } from "../components/ui/segmented.js";
import { Select } from "../components/ui/select.js";
import { Toaster, useToast } from "../components/ui/toast.js";
import { Tip, TooltipProvider } from "../components/ui/tooltip.js";
import type { UiKit } from "./types.js";

/** The kit the package ships: Radix primitives styled with Tailwind (`components/ui`). */
export const defaultUiKit: UiKit = {
  Button,
  Input,
  NativeSelect,
  Checkbox,
  Select,
  Segmented,
  Spinner,
  Skeleton,
  Kbd,
  Dialog,
  DialogContent,
  DialogBody,
  DialogFooter,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
  TooltipProvider,
  Tip,
  Toaster,
  useToast,
};
