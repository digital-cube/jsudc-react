import {
  createContext,
  createElement,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import { type UrlStateAdapter, windowLocationAdapter } from "./adapter.js";

const UrlStateContext = createContext<UrlStateAdapter>(windowLocationAdapter);

export interface UdcUrlStateProviderProps {
  adapter: UrlStateAdapter;
  children?: ReactNode;
}

/** Route the data view's URL state through `adapter`; without it, `windowLocationAdapter`. */
export function UdcUrlStateProvider({ adapter, children }: UdcUrlStateProviderProps) {
  return createElement(UrlStateContext.Provider, { value: adapter }, children);
}

/** The adapter in effect: the nearest provider's, else `windowLocationAdapter`. */
export function useUrlStateAdapter(): UrlStateAdapter {
  return useContext(UrlStateContext);
}

export type SetUrlSearchParams = (
  next: URLSearchParams | ((prev: URLSearchParams) => URLSearchParams),
  opts?: { replace?: boolean },
) => void;

/**
 * `[params, setParams]` over the adapter in effect, shaped like a router's
 * `useSearchParams`. A function passed to `setParams` gets the query string as
 * the adapter has it now, not as the last render saw it, so two quick updates
 * do not both start from the same state.
 */
export function useUrlSearchParams(): [URLSearchParams, SetUrlSearchParams] {
  const adapter = useUrlStateAdapter();
  const snapshot = () => adapter.get().toString();
  // The snapshot is the string: equal strings are equal state, so no render loop.
  const search = useSyncExternalStore(adapter.subscribe, snapshot, snapshot);
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const setParams = useCallback<SetUrlSearchParams>(
    (next, opts) => adapter.set(typeof next === "function" ? next(adapter.get()) : next, opts),
    [adapter],
  );
  return [params, setParams];
}
