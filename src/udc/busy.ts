import { isBusy } from "@jsudc/core";
import type { ToastInput } from "../ui-kit/types.js";

/**
 * The toast for a write the server refused with `busy` (@jsudc/core 0.7.0):
 * another writer held the data's lock longer than the server waits — another
 * process writing the same SQLite file, say. Nothing was written and the same
 * write may simply be tried again, so it is a warning that says so, not a
 * failure carrying the server's text. `null` for any other error.
 */
export function busyToast(
  err: unknown,
  t: (section: string, term: string) => string,
): ToastInput | null {
  if (!isBusy(err)) return null;
  return { variant: "warning", title: t("APP", "BUSY_TITLE"), description: t("APP", "BUSY_BODY") };
}
