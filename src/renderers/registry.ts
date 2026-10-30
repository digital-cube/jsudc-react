import type { RendererDefinition, RendererEntry, RendererRegistry } from "./types";

/**
 * Renderer name → its component and tab, from the renderers a host imports:
 *
 *   createRendererRegistry(tableRenderer, kanbanRenderer)
 *
 * Each renderer is its own subpath (`@jsudc/react/table`, `/kanban`, …), so a
 * page bundles, and a host installs the peers of, only what it registers.
 * `@jsudc/react/all` has `RENDERERS`, the registry of all of them. A later
 * definition of the same name replaces an earlier one.
 */
export function createRendererRegistry(...renderers: RendererDefinition[]): RendererRegistry {
  const registry: Record<string, RendererEntry> = {};
  for (const { name, ...entry } of renderers) registry[name] = entry;
  return Object.freeze(registry);
}

export function rendererEntry(registry: RendererRegistry, name: string): RendererEntry | undefined {
  return Object.hasOwn(registry, name) ? registry[name] : undefined;
}

export interface RendererTab {
  name: string;
  entry: RendererEntry | undefined;
}

/** The tabs of a view: every available renderer, in view order, with its entry when one exists. */
export function rendererTabs(
  registry: RendererRegistry,
  available: readonly string[],
): RendererTab[] {
  return available.map((name) => ({ name, entry: rendererEntry(registry, name) }));
}

/**
 * The tab to draw: the requested one when it is available and registered,
 * else the view's default, else the first available registered one, else
 * `table` (with no renderer registered the data view says so).
 */
export function resolveTab(
  registry: RendererRegistry,
  requested: string,
  available: readonly string[],
  fallback: string,
): string {
  const usable = (n: string) => available.includes(n) && rendererEntry(registry, n) !== undefined;
  if (usable(requested)) return requested;
  if (usable(fallback)) return fallback;
  return available.find(usable) ?? "table";
}
