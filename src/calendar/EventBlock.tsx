import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { cn } from "../lib/utils";
import { ACCENT, type CalendarEvent, type DragKind } from "./model";

/** The tinted fill and edge an event colour draws with, legible in both themes. */
export function eventTint(color: string | null, strength = 16): CSSProperties {
  const c = color ?? ACCENT;
  return {
    background: `color-mix(in srgb, ${c} ${strength}%, var(--surface))`,
    borderLeftColor: c,
  };
}

/** One timed event in a day column: title and time; edges to resize; the body to move. */
export function EventBlock({
  ev,
  style,
  timeLabel,
  startIso,
  readOnly,
  dragging,
  onPointerDown,
  onOpen,
}: {
  ev: CalendarEvent;
  style: CSSProperties;
  timeLabel: string;
  startIso: string;
  readOnly: boolean;
  dragging: boolean;
  onPointerDown: (e: ReactPointerEvent<HTMLElement>, kind: DragKind) => void;
  /** A click (or Enter / Space): the grid drops the click that ends a drag. */
  onOpen: (el: HTMLElement) => void;
}) {
  const short = typeof style.height === "number" && style.height < 36;
  return (
    <button
      type="button"
      data-testid="cal-event"
      data-event-id={ev.id}
      data-start={startIso}
      data-color={ev.color ?? ""}
      aria-label={`${ev.title}, ${timeLabel}`}
      onPointerDown={(e) => onPointerDown(e, "move")}
      onClick={(e) => onOpen(e.currentTarget)}
      className={cn(
        "udc:group/ev udc:absolute udc:z-10 udc:block udc:overflow-hidden udc:rounded-md udc:border-l-[3px] udc:px-1.5 udc:py-0.5 udc:text-left udc:text-foreground udc:select-none",
        "udc:shadow-[0_0_0_1px_var(--surface)] udc:focus-visible:ring-2 udc:focus-visible:ring-ring udc:focus-visible:outline-none",
        readOnly ? "udc:cursor-pointer" : "udc:cursor-grab",
        dragging &&
          "udc:z-30 udc:cursor-grabbing udc:opacity-90 udc:shadow-lg udc:ring-2 udc:ring-primary/40",
      )}
      style={{ ...eventTint(ev.color), ...style }}
    >
      {!readOnly ? (
        <div
          data-testid="cal-resize-start"
          className="udc:absolute udc:inset-x-0 udc:top-0 udc:h-1.5 udc:cursor-ns-resize"
          onPointerDown={(e) => onPointerDown(e, "resize-start")}
        />
      ) : null}
      <div
        className={cn(
          "udc:flex udc:min-w-0 udc:gap-1.5",
          short ? "udc:items-baseline" : "udc:flex-col udc:gap-0",
        )}
      >
        <span className="udc:truncate udc:text-[11.5px] udc:leading-tight udc:font-semibold">
          {ev.title}
        </span>
        <span
          className="udc:truncate udc:text-[10.5px] udc:leading-tight udc:text-muted-foreground udc:tabular-nums"
          data-testid="cal-event-time"
        >
          {timeLabel}
        </span>
      </div>
      {!readOnly ? (
        <div
          data-testid="cal-resize-end"
          className="udc:absolute udc:inset-x-0 udc:bottom-0 udc:h-1.5 udc:cursor-ns-resize udc:after:absolute udc:after:bottom-0.5 udc:after:left-1/2 udc:after:h-0.5 udc:after:w-4 udc:after:-translate-x-1/2 udc:after:rounded-full udc:after:bg-foreground/25 udc:after:opacity-0 udc:group-hover/ev:after:opacity-100"
          onPointerDown={(e) => onPointerDown(e, "resize-end")}
        />
      ) : null}
    </button>
  );
}
