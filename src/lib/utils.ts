import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The library's utilities are `udc:`-prefixed (see styles.css); twMerge has to know, or it
// would not see `udc:px-2` and `udc:px-3` as the same group.
const twMerge = extendTailwindMerge({ prefix: "udc" });

/** Join classes; later `udc:` utilities win over earlier ones of the same group. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** localStorage that never throws (private mode, disabled storage, SSR). */
export const storage = {
  get(key: string): string | null {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Not persisted; the in-memory state still applies.
    }
  },
};

/** `revenue_eur` → `Revenue eur`. */
export function humanize(name: string): string {
  const words = name.replace(/[_-]+/g, " ").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
