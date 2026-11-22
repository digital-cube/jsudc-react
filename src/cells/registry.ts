// The cell registry: components a host registers by name, which a column of the table (and a
// meta field of the cards) draws with when its `render` is that name. No JSX: part of
// `@jsudc/react/headless`.
import type { ColumnConfig, FieldDef, Row } from "@jsudc/core";
import {
  type ComponentType,
  createContext,
  createElement,
  type ReactNode,
  useContext,
  useMemo,
} from "react";

/**
 * What a registered cell component receives. A public contract: from 0.4.0 no
 * prop is renamed, removed or retyped outside a major release; a prop added
 * later is optional.
 */
export interface CellProps {
  /** `row[column.field]`, as the server sent it (blank values included: the cell draws its own empty). */
  value: unknown;
  /** The whole row, `__meta` (id, version) included. */
  row: Row;
  /** The column's config from `view.columns[]` (or the card's meta field): `render`, `render_options`, `align`, … */
  column: ColumnConfig;
  /** The field's definition in the schema; `undefined` for a column naming no field of it. */
  def: FieldDef | undefined;
  /** The collection's name. */
  collection: string;
  /** The UI's language (`en`, `sr`) and its `Intl` locale, for formatting. */
  locale: string;
  intlLocale: string;
  /** The cell edits on double-click (the table's inline editor draws over it). */
  editable: boolean;
  /** Where the cell is drawn: a table cell, or a meta field of a card. */
  surface: "table" | "card";
}

/** A cell component. */
export type CellComponent = ComponentType<CellProps>;

/** One cell as a host defines it: the `render` name a column uses, and its component. */
export interface CellDefinition {
  name: string;
  component: CellComponent;
}

/** `render` name → component. `createCellRegistry` builds one; a plain object works too. */
export type CellRegistry = Readonly<Record<string, CellComponent>>;

/**
 * `render` name → component, from a host's cell definitions:
 *
 *   createCellRegistry({ name: "sender", component: SenderCell })
 *
 * A later definition of the same name replaces an earlier one, and a name of a
 * built-in kind (`badge`, `bool`, `date`, …) replaces that kind.
 */
export function createCellRegistry(...cells: CellDefinition[]): CellRegistry {
  const registry: Record<string, CellComponent> = {};
  for (const { name, component } of cells) registry[name] = component;
  return Object.freeze(registry);
}

/** The component registered for `name`, if any (own names only: `toString` is not a cell). */
export function cellComponent(
  registry: CellRegistry | undefined,
  name: string | undefined,
): CellComponent | undefined {
  if (!registry || name === undefined || !Object.hasOwn(registry, name)) return undefined;
  return registry[name];
}

/** `inner`'s names over `outer`'s; either alone when the other is empty. */
export function mergeCellRegistries(outer: CellRegistry, inner: CellRegistry): CellRegistry {
  if (Object.keys(inner).length === 0) return outer;
  if (Object.keys(outer).length === 0) return inner;
  return Object.freeze({ ...outer, ...inner });
}

const EMPTY: CellRegistry = Object.freeze({});
const CellsContext = createContext<CellRegistry>(EMPTY);

export interface UdcCellsProviderProps {
  /** From `createCellRegistry(...)`. Keep it stable (a module constant or a memo). */
  cells: CellRegistry;
  children: ReactNode;
}

/**
 * Sets the cell components every table and card grid below draws with. Nested
 * providers add up: an inner provider's names win over an outer one's.
 */
export function UdcCellsProvider({ cells, children }: UdcCellsProviderProps) {
  const outer = useContext(CellsContext);
  const value = useMemo(() => mergeCellRegistries(outer, cells), [outer, cells]);
  return createElement(CellsContext.Provider, { value }, children);
}

/** The cell registry in effect: the providers' names, merged; empty when there is none. */
export function useCellRegistry(): CellRegistry {
  return useContext(CellsContext);
}
