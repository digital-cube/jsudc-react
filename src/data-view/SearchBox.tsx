import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/i18n.js";
import { useUiKit } from "../ui-kit/context.js";

export const SEARCH_DEBOUNCE_MS = 300;

/** The search input; reports the text upwards 300 ms after the last keystroke. */
export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (q: string) => void;
  placeholder: string;
}) {
  const { Input } = useUiKit();
  const { t } = useI18n();
  const [text, setText] = useState(value);
  const emitted = useRef(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // The URL changed from elsewhere (clear filters, a pasted link): follow it.
  useEffect(() => {
    if (value !== emitted.current) {
      emitted.current = value;
      setText(value);
    }
  }, [value]);

  useEffect(() => {
    if (text === emitted.current) return;
    const timer = setTimeout(() => {
      emitted.current = text;
      onChange(text);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, onChange]);

  const clear = () => {
    setText("");
    emitted.current = "";
    onChange("");
    inputRef.current?.focus();
  };

  return (
    <div className="udc-search udc:relative udc:w-72 udc:shrink-0">
      <Search className="udc:pointer-events-none udc:absolute udc:top-1/2 udc:left-2.5 udc:size-4 udc:-translate-y-1/2 udc:text-muted-foreground" />
      <Input
        ref={inputRef}
        type="search"
        data-testid="search-input"
        aria-label={t("APP", "SEARCH")}
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && text) {
            e.preventDefault();
            clear();
          }
        }}
        className="udc:pr-8 udc:pl-8 udc:[&::-webkit-search-cancel-button]:hidden"
      />
      {text ? (
        <button
          type="button"
          onClick={clear}
          aria-label={t("APP", "SEARCH_CLEAR")}
          className="udc:absolute udc:top-1/2 udc:right-1.5 udc:grid udc:size-5 udc:-translate-y-1/2 udc:place-items-center udc:rounded-sm udc:text-muted-foreground udc:hover:bg-hover udc:hover:text-foreground"
        >
          <X className="udc:size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
