import { X } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { cn } from "../lib/utils";

/** A list of short strings: Enter or comma adds the typed one, Backspace on empty drops the last. */
export function TagInput({
  id,
  value,
  onChange,
  placeholder,
  invalid,
  "data-testid": testId,
}: {
  id?: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  invalid?: boolean;
  "data-testid"?: string;
}) {
  const [text, setText] = useState("");
  const add = () => {
    const parts = text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length) onChange([...value, ...parts.filter((p) => !value.includes(p))]);
    setText("");
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add();
    } else if (e.key === "Backspace" && !text && value.length) {
      onChange(value.slice(0, -1));
    }
  };
  return (
    <div
      data-testid={testId}
      className={cn(
        "udc:flex udc:min-h-8 udc:w-full udc:flex-wrap udc:items-center udc:gap-1 udc:rounded-md udc:border udc:border-input udc:bg-surface udc:px-1.5 udc:py-1 udc:shadow-xs udc:transition-[border-color,box-shadow]",
        "udc:focus-within:border-ring udc:focus-within:ring-3 udc:focus-within:ring-ring/20",
        invalid &&
          "udc:border-sem-danger udc:focus-within:border-sem-danger udc:focus-within:ring-sem-danger/20",
      )}
    >
      {value.map((v) => (
        <span
          key={v}
          data-testid="tag"
          className="udc:inline-flex udc:h-6 udc:items-center udc:gap-1 udc:rounded-md udc:bg-selected udc:pr-0.5 udc:pl-2 udc:text-xs udc:font-medium"
        >
          {v}
          <button
            type="button"
            aria-label={`Remove ${v}`}
            onClick={() => onChange(value.filter((x) => x !== v))}
            className="udc:grid udc:size-5 udc:place-items-center udc:rounded udc:text-muted-foreground udc:hover:bg-hover udc:hover:text-foreground"
          >
            <X className="udc:size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={add}
        placeholder={value.length ? undefined : placeholder}
        className="udc:h-6 udc:min-w-24 udc:flex-1 udc:bg-transparent udc:px-1 udc:text-[13px] udc:outline-none udc:placeholder:text-muted-foreground/80"
      />
    </div>
  );
}
