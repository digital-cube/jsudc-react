import { createContext, type ReactNode, useContext } from "react";
import { defaultUiKit } from "./default";
import type { UiKit } from "./types";

// Without a provider the renderers draw with the default kit, so a renderer
// mounted on its own (a test, a host page without `UdcProvider`) still works.
const UiKitContext = createContext<UiKit>(defaultUiKit);

export interface UdcUiProviderProps {
  /** The primitives every renderer below draws with. Keep it stable (a module constant). */
  kit: UiKit;
  children: ReactNode;
}

/** Sets the UI kit for everything below it. */
export function UdcUiProvider({ kit, children }: UdcUiProviderProps) {
  return <UiKitContext.Provider value={kit}>{children}</UiKitContext.Provider>;
}

/** The kit in effect: the nearest `UdcUiProvider`'s, else `defaultUiKit`. */
export function useUiKit(): UiKit {
  return useContext(UiKitContext);
}
