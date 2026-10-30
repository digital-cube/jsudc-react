import { createContext, createElement, type ReactNode, useContext } from "react";
import type { RendererRegistry } from "./types";

const EMPTY: RendererRegistry = Object.freeze({});

// No default renderers: the main entry imports none of them, so a page bundles only the ones
// its host registers.
const RenderersContext = createContext<RendererRegistry>(EMPTY);

export interface UdcRenderersProviderProps {
  /** From `createRendererRegistry(...)`, or `RENDERERS` from `@jsudc/react/all`. Keep it stable. */
  renderers: RendererRegistry;
  children: ReactNode;
}

/** Sets the renderers every `UdcDataView` below draws its tabs with. */
export function UdcRenderersProvider({ renderers, children }: UdcRenderersProviderProps) {
  return createElement(RenderersContext.Provider, { value: renderers }, children);
}

/** The registry in effect: the nearest provider's, else an empty one. */
export function useRendererRegistry(): RendererRegistry {
  return useContext(RenderersContext);
}
