import type { CalendarOptions } from "@jsudc/core";
import { useState } from "react";
import { useI18n } from "../i18n/i18n";
import { cn } from "../lib/utils";
import { type CivilDay, dayKey, formatDay, formatTime, sameDay } from "../time/zoned";
import { useUiKit } from "../ui-kit/context";
import { eventTint } from "./EventBlock";
import { type CalendarEvent, type CalendarWindow, eventsOnDay } from "./model";

const DRAG_TYPE = "application/x-udc-event";

/**
 * A cell per day of the weeks the month touches: up to
 * `month_max_chips_per_day` chips, then "+N more" for the rest. A chip drags
 * to another day (keeping its time and length); the day number opens that day.
 */
export function MonthGrid({
  win,
  events,
  opts,
  timeZone,
  today,
  readOnly,
  onMoveToDay,
  onOpen,
  onDay,
}: {
  win: CalendarWindow;
  events: CalendarEvent[];
  opts: CalendarOptions;
  timeZone: string;
  today: CivilDay;
  readOnly: boolean;
  onMoveToDay: (ev: CalendarEvent, day: CivilDay) => void;
  onOpen: (ev: CalendarEvent, el: HTMLElement) => void;
  onDay: (day: CivilDay) => void;
}) {
  const { Popover, PopoverContent, PopoverTrigger } = useUiKit();
  const { t, intlLocale } = useI18n();
  const [over, setOver] = useState<string | null>(null);
  const weekdays = win.days.slice(0, 7);
  const byId = new Map(events.map((e) => [e.id, e]));
  const max = opts.month_max_chips_per_day;

  const chip = (ev: CalendarEvent, inPopover = false) => (
    <button
      key={ev.id}
      type="button"
      draggable={!readOnly}
      data-testid="cal-chip"
      data-event-id={ev.id}
      data-color={ev.color ?? ""}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, ev.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={(e) => onOpen(ev, e.currentTarget)}
      className={cn(
        "udc-calendar-event",
        "udc:flex udc:w-full udc:min-w-0 udc:items-center udc:gap-1 udc:rounded udc:border-l-[3px] udc:px-1 udc:py-px udc:text-left udc:text-[11px] udc:leading-4 udc:text-foreground",
        !readOnly && "udc:cursor-grab",
        inPopover && "udc:py-0.5",
      )}
      style={eventTint(ev.color, 14)}
    >
      <span className="udc:shrink-0 udc:text-muted-foreground udc:tabular-nums">
        {formatTime(ev.start, intlLocale, timeZone)}
      </span>
      <span className="udc:truncate udc:font-medium">{ev.title}</span>
    </button>
  );

  return (
    <div className="udc:flex udc:min-h-0 udc:flex-1 udc:flex-col" data-testid="cal-month">
      <div className="udc:grid udc:grid-cols-7 udc:border-b udc:border-border udc:bg-surface">
        {weekdays.map((d) => (
          <div
            key={dayKey(d)}
            className="udc:border-l udc:border-border udc:py-1.5 udc:text-center udc:text-[11px] udc:font-medium udc:text-muted-foreground udc:uppercase udc:first:border-l-0"
          >
            {formatDay(d, intlLocale, { weekday: "short" })}
          </div>
        ))}
      </div>
      <div
        className="udc:grid udc:min-h-0 udc:flex-1 udc:grid-cols-7 udc:overflow-y-auto"
        style={{ gridAutoRows: "minmax(7rem, 1fr)" }}
      >
        {win.days.map((day) => {
          const key = dayKey(day);
          const list = eventsOnDay(events, day, timeZone);
          const outside = day.m !== win.anchor.m;
          const hidden = list.length - max;
          return (
            // biome-ignore lint/a11y/noStaticElementInteractions: a drop target for chips; the day button is the keyboard way in
            <div
              key={key}
              data-testid="cal-month-cell"
              data-day={key}
              data-count={list.length}
              onDragOver={(e) => {
                if (readOnly || !e.dataTransfer.types.includes(DRAG_TYPE)) return;
                e.preventDefault();
                setOver(key);
              }}
              onDragLeave={() => setOver((o) => (o === key ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const ev = byId.get(e.dataTransfer.getData(DRAG_TYPE));
                if (ev && !readOnly) onMoveToDay(ev, day);
              }}
              className={cn(
                "udc:flex udc:min-w-0 udc:flex-col udc:gap-0.5 udc:border-b udc:border-l udc:border-border udc:p-1 udc:[&:nth-child(7n+1)]:border-l-0",
                outside && "udc:bg-muted/40",
                over === key && "udc:bg-selected",
              )}
            >
              <button
                type="button"
                data-testid="cal-month-day"
                onClick={() => onDay(day)}
                className={cn(
                  "udc:mb-0.5 udc:grid udc:h-6 udc:min-w-6 udc:place-items-center udc:self-start udc:rounded-full udc:px-1 udc:text-xs udc:font-semibold udc:tabular-nums udc:hover:bg-hover",
                  outside && "udc:text-muted-foreground",
                  sameDay(day, today) &&
                    "udc:bg-primary udc:text-primary-foreground udc:hover:bg-primary",
                )}
              >
                {day.d === 1
                  ? formatDay(day, intlLocale, { day: "numeric", month: "short" })
                  : day.d}
              </button>
              {list.slice(0, max).map((ev) => chip(ev))}
              {hidden > 0 ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      data-testid="cal-more"
                      className="udc:self-start udc:rounded udc:px-1 udc:text-[11px] udc:font-medium udc:text-muted-foreground udc:hover:bg-hover udc:hover:text-foreground"
                    >
                      {t("APP", "CAL_MORE", { n: hidden })}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="udc:w-64 udc:p-2" data-testid="cal-more-popover">
                    <div className="udc:mb-1.5 udc:px-1 udc:text-xs udc:font-semibold">
                      {formatDay(day, intlLocale, {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </div>
                    <div className="udc:flex udc:max-h-72 udc:flex-col udc:gap-0.5 udc:overflow-y-auto">
                      {list.map((ev) => chip(ev, true))}
                    </div>
                  </PopoverContent>
                </Popover>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
