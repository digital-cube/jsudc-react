// Row activation and keyboard movement over a list of rows: the active row, a roving tab
// stop, ArrowUp / ArrowDown / j / k / Home / End / Enter, and a click that activates. The
// table and the cards use it; a host renderer gets the same behaviour from
// `@jsudc/react/headless`. No JSX.
import type { Row } from "@jsudc/core";
import {
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

/**
 * The activation props of `UdcDataView` and of `RendererProps`. All optional;
 * with none of them a list behaves as before 0.4.0 (no tab stop on the rows,
 * no keys, no active row).
 */
export interface RowActivationProps {
  /** A row was activated: Enter on it, or a plain click (no modifier, the main button). */
  onRowActivate?: ((row: Row) => void) | undefined;
  /**
   * The row drawn as active (`aria-selected="true"`, `data-active`, the
   * `--selected` background). Passed: controlled, the host moves it in
   * `onActiveRowChange`; `null` is "none". Left out: the list keeps it itself.
   */
  activeRowId?: string | null | undefined;
  /**
   * The active row changed by the user: moved by the keys (without Enter) or a
   * click on another row (before `onRowActivate`). Preview on move here.
   */
  onActiveRowChange?: ((row: Row | null) => void) | undefined;
}

/** Is activation on: any of the three props passed? */
export function rowActivationEnabled(p: RowActivationProps): boolean {
  return (
    p.onRowActivate !== undefined ||
    p.activeRowId !== undefined ||
    p.onActiveRowChange !== undefined
  );
}

export interface UseRowActivationOptions extends RowActivationProps {
  /** The loaded rows, in the order they are drawn. */
  rows: readonly Row[];
  /** Infinite mode: moving past the last loaded row asks for the next page. */
  hasNextPage?: boolean | undefined;
  isFetchingNextPage?: boolean | undefined;
  fetchNextPage?: (() => unknown) | undefined;
  /** Override the default, `rowActivationEnabled(options)`. */
  enabled?: boolean | undefined;
}

/** What to spread on the element of one row (a `<tr>`, a card, an `<li>`). */
export interface RowActivationRowProps {
  ref: (el: HTMLElement | null) => void;
  /** One tab stop for the list: the active row, else the last focused one, else the first. */
  tabIndex: 0 | -1;
  "aria-selected": boolean;
  /** `"true"` on the active row: a stable hook for CSS (`.udc-row[data-active]`). */
  "data-active": "true" | undefined;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
  onFocus: (e: FocusEvent<HTMLElement>) => void;
  onBlur: (e: FocusEvent<HTMLElement>) => void;
}

export interface RowActivation {
  /** Off: `rowProps` is `{}` and the handlers do nothing. */
  enabled: boolean;
  /** The active row's id when it is among `rows`, else `null`. */
  activeRowId: string | null;
  /** The row holding the list's tab stop. */
  tabStopId: string | null;
  /** The props of one row's element (`{}` when off). */
  rowProps: (row: Row) => RowActivationRowProps | Record<string, never>;
  /**
   * A click on the row: a plain click activates it (and focuses it, unless the
   * click went to a focusable cell). A modified or non-main-button click, or one
   * on a link, button, input or menu, is left alone. `true` when it activated.
   */
  handleClick: (e: MouseEvent<HTMLElement>, row: Row) => boolean;
  /** Activate `row` as Enter does: make it active, then `onRowActivate`. */
  activate: (row: Row) => void;
  /** Move the active row, as the keys do, and focus it. */
  move: (to: "next" | "previous" | "first" | "last") => void;
}

/** Elements whose keys belong to them: an input, a cell editor, a menu, a dialog, a list box. */
const OWNS_KEYS =
  'input,textarea,select,[contenteditable=""],[contenteditable="true"],[role="menu"],[role="menubar"],[role="dialog"],[role="alertdialog"],[role="listbox"],[role="combobox"],[role="textbox"],[data-cell-editor]';
/** Where a click is the control's, not the row's. */
const OWNS_CLICK = `a,button,label,${OWNS_KEYS}`;

// Duck-typed, so an element of another realm (an iframe) counts too.
function closestOf(target: EventTarget | null, selector: string): Element | null {
  const el = target as Element | null;
  return el && typeof el.closest === "function" ? el.closest(selector) : null;
}

/** Is `target` inside `container` (a key or click from a portal bubbles through React too)? */
function within(container: HTMLElement, target: EventTarget | null): boolean {
  const node = target as Node | null;
  return !!node && typeof node.nodeType === "number" && container.contains(node);
}

/** Does a key pressed on `target` belong to it rather than to the list? */
export function ownsKeys(target: EventTarget | null): boolean {
  if ((target as HTMLElement | null)?.isContentEditable === true) return true;
  return closestOf(target, OWNS_KEYS) !== null;
}

const idOf = (r: Row) => r.__meta.id;

/**
 * The active row of a list and the keys that move it. Spread `rowProps(row)`
 * on each row's element, call `handleClick` from its `onClick`, and give the
 * list `role="grid"` (rows `role="row"`) while `enabled`.
 */
export function useRowActivation(options: UseRowActivationOptions): RowActivation {
  const { rows, activeRowId: controlledId, onRowActivate, onActiveRowChange } = options;
  const enabled = options.enabled ?? rowActivationEnabled(options);
  const controlled = controlledId !== undefined;
  const [ownId, setOwnId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const rawId = controlled ? controlledId : ownId;
  const has = (id: string | null): id is string => id !== null && rows.some((r) => idOf(r) === id);
  const activeRowId = enabled && has(rawId) ? rawId : null;
  const tabStopId = !enabled
    ? null
    : (activeRowId ?? (has(focusId) ? focusId : null) ?? (rows[0] ? idOf(rows[0]) : null));

  // The latest values, for handlers that outlive a render.
  const latest = useRef({ rows, activeRowId, onRowActivate, onActiveRowChange, controlled });
  latest.current = { rows, activeRowId, onRowActivate, onActiveRowChange, controlled };
  const paging = useRef(options);
  paging.current = options;

  // One stable ref callback per row id, so React does not detach and reattach each render.
  const elements = useRef(new Map<string, HTMLElement>());
  const refs = useRef(new Map<string, (el: HTMLElement | null) => void>());
  const refFor = (id: string) => {
    let cb = refs.current.get(id);
    if (!cb) {
      cb = (el) => {
        if (el) elements.current.set(id, el);
        else elements.current.delete(id);
      };
      refs.current.set(id, cb);
    }
    return cb;
  };

  /** The row id that had focus while the list had it; kept across a refetch that unmounts rows. */
  const focusedRef = useRef<string | null>(null);
  /** Infinite mode: the last row when ArrowDown asked for the next page; moves past it on arrival. */
  const pendingRef = useRef<string | null>(null);

  const focusRow = useCallback((id: string) => {
    const el = elements.current.get(id);
    if (!el) return;
    el.focus({ preventScroll: true });
    if (typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "nearest" });
  }, []);

  const changeActive = useCallback((row: Row) => {
    const now = latest.current;
    if (now.activeRowId === idOf(row)) return;
    if (!now.controlled) setOwnId(idOf(row));
    now.onActiveRowChange?.(row);
  }, []);

  const go = useCallback(
    (row: Row) => {
      setFocusId(idOf(row));
      focusedRef.current = idOf(row);
      changeActive(row);
      focusRow(idOf(row));
    },
    [changeActive, focusRow],
  );

  const activate = useCallback(
    (row: Row) => {
      changeActive(row);
      latest.current.onRowActivate?.(row);
    },
    [changeActive],
  );

  const step = useCallback(
    (from: string | null, to: "next" | "previous" | "first" | "last") => {
      const list = latest.current.rows;
      if (list.length === 0) return;
      if (to === "first") return go(list[0] as Row);
      const last = list.length - 1;
      if (to === "last") return go(list[last] as Row);
      const i = from === null ? -1 : list.findIndex((r) => idOf(r) === from);
      if (i < 0) return go(list[0] as Row);
      const next = to === "next" ? i + 1 : i - 1;
      if (next < 0) return;
      if (next > last) {
        const { hasNextPage, isFetchingNextPage, fetchNextPage } = paging.current;
        if (hasNextPage && fetchNextPage) {
          pendingRef.current = idOf(list[last] as Row);
          if (!isFetchingNextPage) fetchNextPage();
        }
        return;
      }
      go(list[next] as Row);
    },
    [go],
  );

  const move = useCallback(
    (to: "next" | "previous" | "first" | "last") => {
      const now = latest.current;
      step(now.activeRowId ?? focusedRef.current, to);
    },
    [step],
  );

  // A page arrived after ArrowDown on the last row: continue onto its first row.
  useEffect(() => {
    const pending = pendingRef.current;
    if (!enabled || pending === null) return;
    const i = rows.findIndex((r) => idOf(r) === pending);
    const next = i >= 0 ? rows[i + 1] : undefined;
    if (next) {
      pendingRef.current = null;
      go(next);
    } else if (i < 0 || (!options.isFetchingNextPage && !options.hasNextPage)) {
      pendingRef.current = null;
    }
  }, [enabled, rows, go, options.isFetchingNextPage, options.hasNextPage]);

  // Rows unmounted under the focus (a refetch drawing skeletons, a sort): give it back by id.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `rows` is the trigger, not an input
  useLayoutEffect(() => {
    const id = focusedRef.current;
    if (!enabled || id === null) return;
    const el = elements.current.get(id);
    if (!el) return;
    const active = typeof document === "undefined" ? null : document.activeElement;
    if (active === el) return;
    if (active === null || active === document.body) el.focus({ preventScroll: true });
  }, [enabled, rows]);

  // The active row set from outside (the host opened a message) is scrolled into view.
  useEffect(() => {
    if (activeRowId === null) return;
    const el = elements.current.get(activeRowId);
    if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "nearest" });
  }, [activeRowId]);

  const onKeyDown = (e: KeyboardEvent<HTMLElement>, row: Row) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    // A key from a portalled menu or dialog bubbles through React to here: not the list's.
    if (!within(e.currentTarget, e.target)) return;
    if (ownsKeys(e.target)) return;
    const id = idOf(row);
    switch (e.key) {
      case "ArrowDown":
      case "j":
        step(id, "next");
        break;
      case "ArrowUp":
      case "k":
        step(id, "previous");
        break;
      case "Home":
        step(id, "first");
        break;
      case "End":
        step(id, "last");
        break;
      case "Enter":
        // Enter on a link or a button in the row is that control's.
        if (closestOf(e.target, "a,button") !== null && e.target !== e.currentTarget) return;
        activate(row);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const handleClick = (e: MouseEvent<HTMLElement>, row: Row): boolean => {
    if (!enabled || e.defaultPrevented) return false;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
    if (!within(e.currentTarget, e.target)) return false;
    if (closestOf(e.target, OWNS_CLICK)) return false;
    const id = idOf(row);
    setFocusId(id);
    // A click in a focusable cell (an editable one) keeps the focus there.
    const focusable = closestOf(e.target, "[tabindex]");
    if (!focusable || focusable === e.currentTarget) {
      focusedRef.current = id;
      elements.current.get(id)?.focus({ preventScroll: true });
    }
    activate(row);
    return true;
  };

  const rowProps = (row: Row): RowActivationRowProps | Record<string, never> => {
    if (!enabled) return {};
    const id = idOf(row);
    return {
      ref: refFor(id),
      tabIndex: id === tabStopId ? 0 : -1,
      "aria-selected": id === activeRowId,
      "data-active": id === activeRowId ? "true" : undefined,
      onKeyDown: (e) => onKeyDown(e, row),
      onFocus: (e) => {
        if (e.target !== e.currentTarget) return;
        focusedRef.current = id;
        setFocusId(id);
      },
      onBlur: (e) => {
        // Focus left the list (not to another row or a cell of it): forget it.
        const list = e.currentTarget.parentElement;
        if (!list || !within(list, e.relatedTarget)) focusedRef.current = null;
      },
    };
  };

  return { enabled, activeRowId, tabStopId, rowProps, handleClick, activate, move };
}
