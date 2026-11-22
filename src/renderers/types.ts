import type { DescribeResponse, FilterNode, FolderOptions, Row, SortKey } from "@jsudc/core";
import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import type { RowActions } from "../actions/row.js";
import type { ChartWindowState } from "../chart/useChartWindow.js";
import type { RowSelection } from "../rows/useRowSelection.js";
import type { SchemaAction } from "../schema-editor/fieldForm.js";
import type { TableVirtualizeProp } from "../table/useRowWindow.js";
import type { UdcCollectionResult } from "../udc/hooks.js";
import type { PagingMode } from "../udc/keys.js";

/** The row count a renderer that loads its own rows reports to the toolbar. */
export interface RendererCount {
  shown: number;
  total: number | null;
  /**
   * `nodes`: the toolbar reads "N nodes" (the tree), `map`: "N on map of M"
   * (rows without a position are not drawn), `chart`: "N points in window of
   * M" (M counts the filter without the window), instead of "Showing N of M".
   */
  unit?: "nodes" | "map" | "chart";
  /** A source serving a fetched copy (http_api): when it was fetched, and whether it is stale. */
  fetchedAt?: string | null;
  stale?: boolean;
}

/** A folder-shaped collection (`folder_options`): what a folder row or a file row does on click. */
export interface FolderNav {
  options: FolderOptions;
  /** Open a folder by its path (`""`: the root). */
  open: (path: string) => void;
  /** Preview a file row; absent when the view has no preview. */
  openFile?: ((row: Row) => void) | undefined;
}

/** Is `row` a folder of `nav`'s listing (the `..` row included)? */
export function isFolderRow(row: Row, nav: FolderNav): boolean {
  return row[nav.options.kind_field] === nav.options.dir_value;
}

/** What `<UdcDataView>` hands every renderer; each takes the parts it uses. */
export interface RendererProps {
  collection: string;
  /** `describe` with soft-deleted fields already gone. */
  describe: DescribeResponse;
  /** The data view's paged list; loaded only for a renderer with `paging`. */
  data: UdcCollectionResult;
  /** Search, chips and filter tree, composed (the search left out under `listSearch`). */
  filter: FilterNode | undefined;
  /** Chips and filter tree without the search: for a renderer that searches what it loaded. */
  baseFilter: FilterNode | undefined;
  /**
   * The chart window, when the view has one and it applies (on the chart tab,
   * or on any tab once the URL picked it): already ANDed into `filter` and
   * `baseFilter`.
   */
  chartWindow?: ChartWindowState | undefined;
  /** `filter` without the chart window: what "of M" counts. */
  unwindowedFilter?: FilterNode | undefined;
  /** The search box, as typed. */
  search: string;
  /**
   * The text to send as `ListRequest.search` with every list the renderer
   * makes, set only when the collection's source answers search itself
   * (`describe.capabilities.search === "source"`) and the box is not blank.
   * `filter` and `baseFilter` then hold no `contains` for it. Pass it as
   * `search` to `useUdcAllRows` / `useUdcCollection` (0.5.0).
   */
  listSearch?: string | undefined;
  sort: SortKey[];
  onSort: (field: string, multi: boolean) => void;
  mode: PagingMode;
  page: number;
  limit: number;
  onPage: (page: number) => void;
  filtered: boolean;
  onClearFilters: () => void;
  resetKey: string;
  /** Set when the schema may be edited and the renderer has `editMode`. */
  onSchemaAction?: ((a: SchemaAction) => void) | undefined;
  /** For a renderer without `paging`: the count the toolbar shows. */
  onCount: (count: RendererCount | null) => void;
  /** Set when the view has `folder_options`. */
  folder?: FolderNav | undefined;
  /**
   * Row activation (0.4.0; `useRowActivation` of `@jsudc/react/headless` does
   * all of it): Enter or a plain click on a row. Absent unless the host asked.
   */
  onRowActivate?: ((row: Row) => void) | undefined;
  /**
   * The row to draw as active; `null` for none. Set (kept by the view when the
   * host does not control it) whenever activation is on, else absent.
   */
  activeRowId?: string | null | undefined;
  /** Report the active row moving (keys, a click on another row); set whenever activation is on. */
  onActiveRowChange?: ((row: Row | null) => void) | undefined;
  /**
   * Row selection (0.5.0; `useRowSelection` of `@jsudc/react/headless`): set
   * when the view selects (`view.multiselect`, `view.bulk_actions`, or the
   * `selectable` prop) and the renderer reads the paged list; absent
   * otherwise. Draw a checkbox from `isSelected`, drive it with `toggle`,
   * `setPage`, `selectAllMatching` and `clear`; the view draws the bulk bar.
   */
  selection?: RowSelection | undefined;
  /**
   * Row actions (0.5.0; `RowActions` of `@jsudc/react/headless`): set when the
   * view declares `row_action_defs` or `row_actions`, absent otherwise. Draw
   * `eligible(row)` as `display` says, label each with `label`, run one with
   * `run(def, row)` (the host's handler, else the server, as the bulk bar).
   */
  rowActions?: RowActions | undefined;
  /**
   * Long lists (0.5.0): `UdcDataView`'s `virtualize`, passed only when the host set it. The
   * table windows its rows in infinite mode by it; other renderers ignore it.
   */
  virtualize?: TableVirtualizeProp | undefined;
}

export interface RendererEntry {
  component: ComponentType<RendererProps>;
  icon: LucideIcon;
  /** `APP.<labelKey>` is the tab label. */
  labelKey: string;
  /** Reads the data view's paged list: the paging toggle shows, the list loads. */
  paging: boolean;
  /** Offers the schema editor (column menus, add column). */
  editMode: boolean;
  /** Extra controls in the toolbar while this tab is open. */
  toolbar?: ComponentType<{ collection: string; describe: DescribeResponse }>;
}

/** One renderer as its subpath exports it (`tableRenderer` from `@jsudc/react/table`). */
export interface RendererDefinition extends RendererEntry {
  /** The name a view lists in `available_renderers`. */
  name: string;
}

/** Renderer name → entry: what `UdcDataView` draws its tabs with. `createRendererRegistry` builds one. */
export type RendererRegistry = Readonly<Record<string, RendererEntry>>;
