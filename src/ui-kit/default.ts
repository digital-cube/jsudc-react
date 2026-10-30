import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Input, NativeSelect } from "../components/ui/input";
import { Kbd, Skeleton, Spinner } from "../components/ui/misc";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Segmented } from "../components/ui/segmented";
import { Select } from "../components/ui/select";
import { Toaster, useToast } from "../components/ui/toast";
import { Tip, TooltipProvider } from "../components/ui/tooltip";
import type { UiKit } from "./types";

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
