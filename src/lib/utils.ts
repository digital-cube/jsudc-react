import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The library's utilities are `udc:`-prefixed (see styles.css); twMerge has to know, or it
// would not see `udc:px-2` and `udc:px-3` as the same group.
const twMerge = extendTailwindMerge({ prefix: "udc" });

/** Join classes; later `udc:` utilities win over earlier ones of the same group. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export { humanize, storage } from "./storage";
