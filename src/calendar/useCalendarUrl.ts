import { type CalendarOptions, type CalendarPreset, isCalendarPreset } from "@jsudc/core";
import { type CivilDay, dayKey, parseDayKey } from "../time/zoned";
import { useUrlSearchParams } from "../url-state/UrlState";
import { stepAnchor } from "./model";

export const PRESET_PARAM = "preset";
export const DATE_PARAM = "date";

/** `?preset=&date=`: what the calendar shows. The zone is a preference, not URL state. */
export function useCalendarUrl(opts: CalendarOptions, today: CivilDay) {
  const [params, setParams] = useUrlSearchParams();
  const presetOf = (p: URLSearchParams): CalendarPreset => {
    const raw = p.get(PRESET_PARAM);
    return isCalendarPreset(raw) && opts.available_presets.includes(raw)
      ? raw
      : opts.default_preset;
  };
  const anchorOf = (p: URLSearchParams) => parseDayKey(p.get(DATE_PARAM)) ?? today;
  // Every change starts from the address bar as it is now (the updater's argument), not as
  // the last render saw it: navigations render in a transition, so two quick clicks would
  // both step from the same day.
  const update = (edit: (p: URLSearchParams) => Record<string, string>) =>
    setParams(
      (now) => {
        const next = new URLSearchParams(now);
        for (const [k, v] of Object.entries(edit(now))) next.set(k, v);
        return next;
      },
      { replace: true },
    );
  return {
    preset: presetOf(params),
    anchor: anchorOf(params),
    setPreset: (p: CalendarPreset) => update(() => ({ [PRESET_PARAM]: p })),
    setAnchor: (d: CivilDay) => update(() => ({ [DATE_PARAM]: dayKey(d) })),
    step: (dir: 1 | -1) =>
      update((p) => ({ [DATE_PARAM]: dayKey(stepAnchor(presetOf(p), anchorOf(p), dir)) })),
    openDay: (d: CivilDay) => update(() => ({ [PRESET_PARAM]: "day", [DATE_PARAM]: dayKey(d) })),
  };
}
