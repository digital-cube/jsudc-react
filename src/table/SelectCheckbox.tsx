import { useEffect, useRef } from "react";
import { cn } from "../lib/utils.js";

/**
 * The selection checkbox of a row, a card or the page: a native checkbox (it
 * has the indeterminate state and reports a shift-click), labelled for screen
 * readers. `onToggle(range)`: `range` is true for a shift-click. The label
 * around it widens the hit area to the whole cell.
 */
export function SelectCheckbox({
  checked,
  indeterminate = false,
  disabled = false,
  label,
  onToggle,
  className,
  "data-testid": testId,
}: {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  label: string;
  onToggle: (range: boolean) => void;
  className?: string;
  "data-testid"?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <label
      className={cn(
        "udc-select udc:flex udc:h-full udc:w-full udc:cursor-pointer udc:items-center udc:justify-center",
        className,
      )}
      // A shift-click selects a range: keep the browser from selecting text on the way.
      onMouseDown={(e) => {
        if (e.shiftKey) e.preventDefault();
      }}
    >
      <input
        ref={ref}
        type="checkbox"
        data-testid={testId}
        aria-label={label}
        aria-checked={indeterminate ? "mixed" : checked}
        checked={checked}
        disabled={disabled}
        onChange={() => {}}
        onClick={(e) => onToggle(e.shiftKey)}
        className="udc:size-4 udc:cursor-pointer udc:accent-primary udc:disabled:cursor-default"
      />
    </label>
  );
}
