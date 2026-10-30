// Helpers without a styling dependency, for the headless entry; `lib/utils` re-exports them.

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
