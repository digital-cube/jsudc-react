# @jsudc/react

[![npm](https://img.shields.io/npm/v/@jsudc/react)](https://www.npmjs.com/package/@jsudc/react)

React components for UDC (Universal Data Collection) collections. Give it a
collection name and `<UdcDataView>` asks a UDC server what the collection is
(`describe`) and draws it: search, filter chips and a filter builder, paging,
and one tab per renderer the view declares — **table**, **cards**, **kanban**,
**calendar**, **tree**, **map** and **chart** — with inline edits, drag and
drop, and a schema editor that adds, edits and deletes columns at runtime.

What is in the package:

- **`UdcProvider`** and **`createUdcQueryClient`**, and TanStack Query hooks over
  the transport client of [`@jsudc/core`](https://github.com/digital-cube/jsudc-core)
  (`useUdcCollections`, `useUdcDescribe`, `useUdcCollection`, `useUdcAllRows`,
  `useUdcMutate`, `useUdcMutateMany`, `useUdcAction`, `useUdcSchema`,
  `useUdcSource`);
- **`UdcDataView`** and **`createRendererRegistry`**; each renderer is a
  subpath of its own (`@jsudc/react/table`, `/cards`, `/kanban`, `/calendar`,
  `/tree`, `/map`, `/chart`), so a page bundles, and a host installs the peers
  of, only the renderers it registers; `@jsudc/react/all` has them all
  (see [Renderers](#renderers));
- **`@jsudc/react/headless`**: the hooks and every renderer's model without any
  markup, for a host that draws its own (see [Headless](#headless));
- **`UdcI18nProvider`** + **`useI18n`**: the library's strings in English and
  Serbian, with your own sections, overrides and locales layered over them;
- **`ThemeProvider`** + **`useTheme`** (light / dark), **`TimezoneProvider`**
  (the zone instants are shown in);
- the UI primitives the renderers are built from (Radix + Tailwind, the shadcn
  pattern): `Button`, `Input`, `Checkbox`, `Select`, `Dialog`, `DropdownMenu`,
  `Popover`, `Tip`, `Segmented`, `Spinner`, `Skeleton`, and the `Toaster` and
  `TooltipProvider` the data view needs;
- **`styles.css`**, compiled at build time with every utility `udc:`-prefixed, so
  it cannot collide with a host's own Tailwind, and **`tokens.css`**, its design
  tokens (see [Styling](#styling)).

```sh
npm install @jsudc/react @jsudc/core \
  react react-dom @tanstack/react-query radix-ui lucide-react
# then the peers of the renderers you register (see Renderers), all of them:
npm install @tanstack/react-table leaflet recharts @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
# or straight from a GitHub tag:
npm install github:digital-cube/jsudc-core#v0.5.0 github:digital-cube/jsudc-react#v0.5.1
```

## Quick start

```tsx
import "@jsudc/react/styles.css";
import { UdcClient } from "@jsudc/core/client";
import { createUdcQueryClient, UdcDataView, UdcI18nProvider, UdcProvider } from "@jsudc/react";
import { RENDERERS } from "@jsudc/react/all"; // every renderer; or a registry of a few, see Renderers
import { Toaster, TooltipProvider } from "@jsudc/react/ui";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";

const client = new UdcClient({ httpUrl: "" }); // same origin; or "https://api.example.com"

createRoot(document.getElementById("root") as HTMLElement).render(
  <UdcProvider client={client} renderers={RENDERERS}>
    <QueryClientProvider client={createUdcQueryClient()}>
      <UdcI18nProvider>
        <TooltipProvider>
          <Toaster>
            <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
              <UdcDataView collection="companies" />
            </div>
          </Toaster>
        </TooltipProvider>
      </UdcI18nProvider>
    </QueryClientProvider>
  </UdcProvider>,
);
```

The server is any UDC server, for example
[`@jsudc/server`](https://github.com/digital-cube/jsudc-server). It must be
same-origin, behind your dev server's proxy, or send CORS headers itself: the
client `POST`s JSON to `<httpUrl>/udc/<action>`.

`<UdcDataView>` fills its parent as a flex column (`flex: 1`, `min-height: 0`),
so give the parent a height. Key it by collection
(`<UdcDataView key={name} collection={name} />`) when one route shows many
collections, so each one starts from a fresh view.

### The providers a host wraps

| Provider                                              | Needed | Why                                                                                                                                                         |
| ----------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UdcProvider client={new UdcClient(...)}`             | yes    | every hook reads the client from it; `renderers={…}` is what the data view draws its tabs with (none given: every tab says no renderer is registered)       |
| `QueryClientProvider client={createUdcQueryClient()}` | yes    | the hooks are TanStack Query; `createUdcQueryClient` retries transport failures only, never a protocol error; `onUnauthenticated` see [Sessions](#sessions) |
| `UdcI18nProvider`                                     | yes    | every string goes through `useI18n()`                                                                                                                       |
| `TooltipProvider`                                     | yes    | Radix tooltips on headers, chips and buttons; with your own kit, `kit.TooltipProvider` (see [Bring your own primitives](#bring-your-own-primitives))        |
| `Toaster`                                             | yes    | save, conflict and schema-edit toasts (`useToast`); with your own kit, `kit.Toaster`                                                                        |
| `UdcUrlStateProvider` / `UdcReactRouterUrlState`      | no     | where search, filters, sort, paging and the tab live; without it `window.location` (see [URL state](#url-state))                                            |
| `UdcLinksProvider` / `collectionPath`                 | no     | where lookup links and `row_link`s go; without it `/c/<collection>` (see [Lookups and drill-down](#lookups-and-drill-down))                                 |
| `TimezoneProvider`                                    | no     | without it instants are shown in the browser's zone; with it the user's pick, kept in `localStorage` (`udc-tz`)                                             |
| `ThemeProvider`                                       | no     | `useTheme()` toggles the `dark` class on `<html>` and keeps the choice (`udc-theme`); any other way of setting that class works too                         |

## Renderers

The package root imports no renderer. A host registers the ones it shows, each
from its own subpath, and only those (with their peers) end up in its bundle:

```tsx
import { createRendererRegistry, UdcProvider } from "@jsudc/react";
import { cardsRenderer } from "@jsudc/react/cards";
import { tableRenderer } from "@jsudc/react/table";

// A module constant: the registry should not change between renders.
const renderers = createRendererRegistry(tableRenderer, cardsRenderer);

<UdcProvider client={client} renderers={renderers}>
  …
</UdcProvider>;
```

`RENDERERS` from `@jsudc/react/all` is the registry of all seven. A view's tab
whose renderer is not registered is drawn disabled; `UdcDataView renderers={…}`
overrides the provider's registry for one view. A renderer of your own is one
more definition: `{ name: "gantt", component, icon, labelKey, paging, editMode }`
(`component` takes `RendererProps`), and a later definition of a name replaces
an earlier one, so `createRendererRegistry(tableRenderer, myTable)` swaps the
table.

| Subpath                      | Exports                                                       | Peers it needs (optional peers of the package)             |
| ---------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------- |
| `@jsudc/react/table`         | `tableRenderer`, `TableRenderer`, `CellValue`, `Pager`        | `@tanstack/react-table`                                    |
| `@jsudc/react/cards`         | `cardsRenderer`, `CardRenderer`                               | —                                                          |
| `@jsudc/react/kanban`        | `kanbanRenderer`, `KanbanRenderer`, `KanbanBoardSwitcher`     | `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` |
| `@jsudc/react/calendar`      | `calendarRenderer`, `CalendarRenderer`                        | —                                                          |
| `@jsudc/react/tree`          | `treeRenderer`, `TreeRenderer`                                | `@dnd-kit/core`                                            |
| `@jsudc/react/map`           | `mapRenderer`, `MapRenderer`                                  | `leaflet`                                                  |
| `@jsudc/react/chart`         | `chartRenderer`, `ChartRenderer`                              | `recharts`                                                 |
| `@jsudc/react/schema-editor` | `useSchemaEditor`, the field dialogs, the `fieldForm` helpers | —                                                          |
| `@jsudc/react/all`           | `RENDERERS` and every `…Renderer` definition                  | all of the above                                           |
| `@jsudc/react/headless`      | hooks and models, no markup (below)                           | none: `react`, `@tanstack/react-query`, `@jsudc/core` only |

A subpath whose peer is not installed fails at that import and nowhere else:
Node stops with `ERR_MODULE_NOT_FOUND` for `leaflet`; Vite, which knows the
peer is optional, builds and the import throws
`Could not resolve "leaflet/dist/leaflet.css" imported by "@jsudc/react". Is it installed?`
when the module loads. The root, `/table`, `/cards`, `/calendar` and
`/headless` load without it.

### Writing a renderer: the `RendererProps` contract

A host draws rows its own way (a message list, a timeline) by registering a
renderer of its own; `UdcDataView` hands its `component` the props below. They
are a **public contract**: from 0.4.0 none of them is renamed, removed or
retyped outside a major release, and a prop added later is optional, so a
renderer written today keeps compiling (the package's `npm run check:types`
compiles a host-written renderer against the published declarations and fails
when this table drifts).

| Prop                                 | Type                                       | What it is                                                                                                                        |
| ------------------------------------ | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `collection`                         | `string`                                   | the collection's name                                                                                                             |
| `describe`                           | `DescribeResponse`                         | its schema, view and capabilities, soft-deleted fields already gone                                                               |
| `data`                               | `UdcCollectionResult`                      | the view's paged list (`rows`, `total`, `isLoading`, `error`, `hasNextPage`, `fetchNextPage`, …); loaded only when `paging: true` |
| `filter`                             | `FilterNode \| undefined`                  | everything that filters the rows, composed: the host's `filter`, search, chips, the filter tree, the chart window                 |
| `baseFilter`                         | `FilterNode \| undefined`                  | `filter` without the search, for a renderer that searches what it loaded                                                          |
| `unwindowedFilter`                   | `FilterNode \| undefined` (optional)       | `filter` without the chart window: what "of M" counts                                                                             |
| `chartWindow`                        | `ChartWindowState \| undefined` (optional) | the chart window when one applies (already in `filter`)                                                                           |
| `search`                             | `string`                                   | the search box as typed (for highlighting)                                                                                        |
| `listSearch`                         | `string \| undefined` (optional)           | the text to send as `search` with every list, when the source answers search itself ([Search](#search-answered-by-the-source))    |
| `sort`, `onSort(field, multi)`       | `SortKey[]`, function                      | the sort and the header click that cycles it                                                                                      |
| `mode`, `page`, `limit`, `onPage(n)` | `"pages" \| "infinite"`, numbers, function | the paging mode, the 1-based page, the page size, go to a page                                                                    |
| `filtered`, `onClearFilters()`       | `boolean`, function                        | did the user filter (the host's `filter` does not count), and "clear filters" for the empty state                                 |
| `resetKey`                           | `string`                                   | changes whenever the rows mean something else: scroll back to the top on it                                                       |
| `onCount(count \| null)`             | function                                   | a renderer with `paging: false` reports what the toolbar's "Showing N of M" says (`RendererCount`)                                |
| `onSchemaAction`                     | function (optional)                        | set when the schema may be edited and the renderer has `editMode`                                                                 |
| `folder`                             | `FolderNav \| undefined` (optional)        | set when the view has `folder_options`                                                                                            |
| `onRowActivate(row)`                 | function (optional)                        | Enter or a plain click on a row ([Row activation and keyboard](#row-activation-and-keyboard)); set only when the host passed one  |
| `activeRowId`                        | `string \| null` (optional)                | the row to draw as active; set whenever activation is on (the view keeps it when the host does not)                               |
| `onActiveRowChange(row \| null)`     | function (optional)                        | report the active row moving (keys, a click on another row); set whenever activation is on                                        |
| `selection`                          | `RowSelection` (optional)                  | the row selection ([Selection and bulk actions](#selection-and-bulk-actions)); set while the view selects and the renderer pages  |
| `rowActions`                         | `RowActions` (optional)                    | the actions of each row ([Row actions](#row-actions)); set when the view declares `row_action_defs` or `row_actions`              |
| `virtualize`                         | `TableVirtualizeProp` (optional)           | the table's long-list windowing ([Long lists](#long-lists)); passed only when the host set `UdcDataView virtualize`               |

The three activation props are absent unless the host turned activation on;
`useRowActivation` of `@jsudc/react/headless` does everything they describe
(see [Row activation and keyboard](#row-activation-and-keyboard)). How one
column's cells are drawn is not a renderer's business: see
[Custom cells](#custom-cells).

A renderer with `paging: true` draws `data` and needs nothing else; one with
`paging: false` loads its own rows with `filter` and `listSearch` (the hooks
of `@jsudc/react/headless`, e.g. `useUdcAllRows({ filter, search: listSearch })`)
and reports `onCount`. A message
list of a mail client:

```tsx
import { createRendererRegistry, type RendererDefinition, type RendererProps } from "@jsudc/react";
import { tableRenderer } from "@jsudc/react/table";
import { Inbox } from "lucide-react";

function MessageList({ data, filtered, onClearFilters, mode, page, limit, onPage }: RendererProps) {
  if (data.isLoading) return <p>Loading…</p>;
  if (data.rows.length === 0) {
    return filtered ? <button onClick={onClearFilters}>Clear filters</button> : <p>No messages</p>;
  }
  return (
    <div>
      <ul>
        {data.rows.map((row) => (
          <li key={row.__meta.id}>
            <b>{String(row.subject)}</b> · {String(row.from)}
          </li>
        ))}
      </ul>
      {mode === "infinite" && data.hasNextPage ? (
        <button onClick={data.fetchNextPage}>More</button>
      ) : null}
      {mode === "pages" && data.total !== null && page * limit < data.total ? (
        <button onClick={() => onPage(page + 1)}>Next</button>
      ) : null}
    </div>
  );
}

export const messageList: RendererDefinition = {
  name: "messages", // the name a view lists in available_renderers
  component: MessageList,
  icon: Inbox,
  labelKey: "TAB_MESSAGES", // APP.TAB_MESSAGES, through `messages` of UdcI18nProvider
  paging: true, // reads `data`: the list loads, the paging toggle shows
  editMode: false,
};

const renderers = createRendererRegistry(tableRenderer, messageList);
```

## Headless

`@jsudc/react/headless` is the data layer under the renderers, with no JSX, no
CSS and no renderer peer (a test walks its imports): a host on Material, Ant or
plain HTML builds its own renderer on it and gets the same queries, filters and
URL state.

- the client context and the hooks: `useUdcClient`, `useUdcDescribe`,
  `useUdcCollection`, `useUdcAllRows`, `useUdcMutate`, `useUdcSchema`, `udcKeys`,
  and the change feed's `useUdcChanges` (see [Live updates](#live-updates));
- the data view's state: `useDataViewState` (tab, search, chips, filter tree,
  sort, paging in the URL), `composeFilter`, the URL codecs of `urlState.ts`,
  `liveDescribe` / `liveSort`, the folder helpers;
- each renderer's model and state hook: `useKanbanBoard` and the drop planner,
  `useChartWindow` and the chart series model, `useCalendarUrl` and the
  calendar window model, the card, map and tree models (`planTreeDrop`,
  `TreeDropPlan`: the tree's names, prefixed), `useTreeExpand`;
- `applyTransforms`, `displayText`, `renderKind` and the cell formatters;
  the zone helpers and `useTimezone`;
- `useRowActivation` (the active row and the keys, see
  [Row activation and keyboard](#row-activation-and-keyboard)), `useRowSelection`
  and what runs a bulk action (`planBulkAction`, `bulkActionEligible`, see
  [Selection and bulk actions](#selection-and-bulk-actions)) and the cell
  registry (`createCellRegistry`, `UdcCellsProvider`, `useCellRegistry`, see
  [Custom cells](#custom-cells));
- the registry functions (`createRendererRegistry`, `resolveTab`) and the URL
  state adapters (`windowLocationAdapter`, `prefixUrlStateAdapter`,
  `createMemoryUrlStateAdapter`), so its hooks behave exactly as inside
  `UdcDataView`.

## URL state

The data view keeps what the user chose in the query string, so a link or a
reload opens the same view: the tab (`?tab=`), the search (`?q=`), the chips
and the filter tree, the sort, the paging mode and the page, the kanban board
(`?board=`; without it, the board an `eq` filter on the board field names, else
the first), the chart window (`?win=`, `?from=&to=`) and the calendar
(`?preset=&date=`). Filters, sort and windows **replace** the current history
entry; they are not a step the Back button walks through.

It reaches the address bar through a `UrlStateAdapter`:

```ts
interface UrlStateAdapter {
  get(): URLSearchParams;
  set(next: URLSearchParams, opts?: { replace?: boolean }): void;
  subscribe(listener: () => void): () => void; // back / forward
}
```

**Default: no router needed.** Without a provider the view uses
`windowLocationAdapter`: `window.location.search`, written with
`history.pushState` / `replaceState`, the path and the hash left alone, read
again on `popstate`. That is all a plain React page needs.

**On react-router** (^7), mount the adapter from the subpath inside your
router, around the views. It is the only module of the package that imports
react-router, and react-router is an optional peer for it:

```tsx
import { UdcReactRouterUrlState } from "@jsudc/react/react-router";

<BrowserRouter>
  <UdcReactRouterUrlState>
    <App />
  </UdcReactRouterUrlState>
</BrowserRouter>;
```

With a data router, put it in the root route's element. Use it whenever the
host navigates with react-router: the default adapter writes the History API
behind the router's back, so the router would not see the change.

**Any other router**: write the three calls and mount them with
`UdcUrlStateProvider`. `get` is called during render, so return the current
query string cheaply; `subscribe` only has to report changes the view did not
make itself, or none at all when a new adapter object is passed on every
location change (that re-renders the view's hooks too). Two sketches, to adapt
to your router's version. TanStack Router:

```tsx
import { UdcUrlStateProvider, type UrlStateAdapter } from "@jsudc/react";
import { useLocation, useRouter } from "@tanstack/react-router";
import { useMemo } from "react";

function TanStackUrlState({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchStr = useLocation({ select: (l) => l.searchStr });
  const adapter = useMemo<UrlStateAdapter>(
    () => ({
      get: () => new URLSearchParams(router.state.location.searchStr),
      set: (next, opts) => {
        const qs = next.toString();
        router.history[opts?.replace ? "replace" : "push"](
          `${router.state.location.pathname}${qs ? `?${qs}` : ""}`,
        );
      },
      subscribe: () => () => {},
    }),
    // biome-ignore lint/correctness/useExhaustiveDependencies: a new adapter per query string
    [router, searchStr],
  );
  return <UdcUrlStateProvider adapter={adapter}>{children}</UdcUrlStateProvider>;
}
```

Next.js (App Router, a client component):

```tsx
"use client";
import { UdcUrlStateProvider, type UrlStateAdapter } from "@jsudc/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

export function NextUrlState({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const adapter = useMemo<UrlStateAdapter>(
    () => ({
      get: () => new URLSearchParams(search),
      set: (next, opts) => {
        const qs = next.toString();
        const url = `${pathname}${qs ? `?${qs}` : ""}`;
        if (opts?.replace) router.replace(url, { scroll: false });
        else router.push(url, { scroll: false });
      },
      subscribe: () => () => {},
    }),
    [router, pathname, search],
  );
  return <UdcUrlStateProvider adapter={adapter}>{children}</UdcUrlStateProvider>;
}
```

`useUrlSearchParams()` gives your own components the same
`[params, setParams]` pair the view uses, over whichever adapter is in effect;
a function passed to `setParams` receives the query string as it is now.

### Default sort

Without a `sort` in the URL state, a list goes out with the view's
`default_sort` (`view.yaml`, `@jsudc/core` 0.5.2), or the host's `defaultSort`
prop instead of it (`[]` turns the view's off):

```yaml
default_sort:
  - { field: received_at, dir: desc }
```

```tsx
<UdcDataView collection="mail_messages" defaultSort={[{ field: "received_at", dir: "desc" }]} />;
```

The very first `list` of a fresh page is already in that order, with any URL
adapter (the address bar, react-router, memory). The default is **not written
into the URL**: an absent `sort` means it, so a link stays short and a later
change of the default reaches old links. It is the `sort` renderers get
(`RendererProps.sort`), so the table's header shows it. A header click starts
from it (`received_at` desc → none → asc); "none" is written as an empty
`sort=`, so the default does not come back, and picking the default again
removes the parameter. While a search answered by the source
(`capabilities.search: "source"`) is typed and the user has picked no sort, the
default steps aside: the source answers best match first, and the default
returns when the box is cleared. A search composed into the filter (`contains`)
has no order of its own, so the default stays.

The prop and the view key are read by `@jsudc/react` against a `@jsudc/core`
of 0.5.0 too (whose loose view parse keeps the key); an ill-formed
`default_sort` reads as none.

Two views on one page, or a view inside a host route with parameters of its
own: give each a prefix (`urlPrefix`) or keep its state in memory
(`urlState="memory"`), see [Embedding a view](#embedding-a-view).

## Embedding a view

`UdcDataView` can be one pane of a host's screen rather than a page: the
message list of a mail client between its folder list and its reading pane.
Every prop below is optional; without them the view is what it always was.

| Prop                         | What it does                                                                                                                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `filter`                     | a `FilterNode` of the host's (the open folder), ANDed into every list the view and its renderers load and counted in "of M"; not a chip or pill, not in the URL, not removed by "clear filters" |
| `chrome`                     | which parts of the frame are drawn: `"full"` (default), `"embedded"`, or flags                                                                                                                  |
| `pagingMode`                 | the paging mode to open in, instead of the view's `pagination`                                                                                                                                  |
| `defaultSort`                | the order the rows come in until the user picks one, instead of the view's `default_sort` (`[]`: none); see [Default sort](#default-sort)                                                       |
| `toolbarStart`, `toolbarEnd` | the host's own controls at the start (before the search) and at the end (after the count) of the toolbar                                                                                        |
| `urlPrefix`                  | a prefix for every parameter the view and its renderers read and write                                                                                                                          |
| `urlState`                   | `"url"` (default: the adapter in effect), `"memory"`, or any `UrlStateAdapter`                                                                                                                  |

**The host's filter** is what the host decides and the user does not: the
folder, the account, the project. The user still searches, picks chips and
builds filters on top of it; "Clear" and "Clear filters" remove theirs and
leave the host's; an empty folder shows "no rows", not "no rows match, clear
filters". It reaches every renderer through `filter` / `baseFilter` (see
[the contract](#writing-a-renderer-the-rendererprops-contract)), so the
kanban, the calendar, the tree, the map and the chart load the folder's rows
too. Change it and the view asks again; an equal object passed anew each
render asks nothing.

**Chrome.** `chrome` is a preset or flags, `true` drawing the part; a flag
left out takes the preset's value (`full`: all on, `embedded`: all off):

| Flag           | The part                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `header`       | the title and the description                                                                                                                           |
| `tabs`         | the renderer tabs (with Doc or Source still on, the renderer in use stays as the way back)                                                              |
| `pagingToggle` | the pages / infinite switch; without it the mode is `pagingMode`, else the view's `pagination`, never a choice stored by an earlier session or `?mode=` |
| `docTab`       | the Doc pseudo-tab (the collection's README)                                                                                                            |
| `sourceTab`    | the Source pseudo-tab (the source file)                                                                                                                 |
| `frame`        | the card around toolbar and rows: border, rounding, shadow and the outer margins                                                                        |

`chrome="embedded"` leaves the toolbar and the rows only;
`chrome={{ preset: "embedded", tabs: true }}` adds the tabs back. The parts
keep their [stable classes](#stable-classes); `data-testid="data-view-frame"`
carries `data-framed`.

The toolbar is not part of the frame: its flags are on in either preset, so
`"embedded"` keeps it. A host whose screen has a toolbar of its own turns it
off:

| Flag            | The part                                                                                                                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `toolbar`       | the toolbar row as a whole; `false` leaves no toolbar element, with every control below, the renderer's own controls, the live indicator, the chart window control and `toolbarStart` / `toolbarEnd` |
| `search`        | the search box (when the view has `search`)                                                                                                                                                          |
| `chips`         | the filter chips (when the view has `filters`)                                                                                                                                                       |
| `filterBuilder` | the "Filter" button that opens the filter builder                                                                                                                                                    |
| `freshness`     | "Updated …" and the stale pill                                                                                                                                                                       |
| `count`         | the row count                                                                                                                                                                                        |

`chrome={{ preset: "embedded", toolbar: false }}` draws the rows alone. The
filter pills and the bulk bar are rows of their own, not the toolbar: they
still show when there is a filter or a selection. What the toolbar showed is
in the renderer's `data` (`rows.length`, `total`, `isFetching`, `fetchedAt`),
for a renderer of the host's to lift into the host's own toolbar. A filter,
search or chip in the URL still applies with its control off.

**URL state per view.** By default the view's parameters are the page's own
(`?q=`, `?sort=`, …), which is right for a view that is the page. A pane
shares the query string with its host and maybe with other views, so:

- `urlPrefix="inbox."` makes the view and its renderers use `inbox.q`,
  `inbox.sort`, `inbox.p`, `inbox.board`, `inbox.win`, … and leave every
  other parameter alone: a host route with a `?q=` of its own is neither read
  nor removed, and two views with different prefixes keep separate search,
  sort and page on one page. End the prefix with a separator: every key that
  starts with it is the view's.
- `urlState="memory"` keeps the view's state in memory, its own store: the
  address bar is never touched, and a reload starts afresh.
- `urlState={adapter}` uses any `UrlStateAdapter` (a host store, a router
  adapter); `urlPrefix` applies on top of it.

Both are adapters, exported from the root and from `@jsudc/react/headless`
for a host's own components and headless renderers:
`prefixUrlStateAdapter(inner, prefix)` wraps any `UrlStateAdapter` (it reads
and writes only its own keys; `subscribe` is the inner one's), and
`createMemoryUrlStateAdapter(initial?)` is a store of its own (its `history`
lists what was written). Because the prefix applies at the adapter, every
parameter is covered, the kanban's, the chart's and the calendar's included:

```tsx
import { prefixUrlStateAdapter, UdcUrlStateProvider, useUrlStateAdapter } from "@jsudc/react";
import { type ReactNode, useMemo } from "react";

/** The host's own controls of the pane share the view's `inbox.` parameters. */
function InboxPane({ children }: { children: ReactNode }) {
  const inEffect = useUrlStateAdapter();
  const adapter = useMemo(() => prefixUrlStateAdapter(inEffect, "inbox."), [inEffect]);
  // Inside: useUrlSearchParams() sees `q` where the address bar has `inbox.q`.
  return <UdcUrlStateProvider adapter={adapter}>{children}</UdcUrlStateProvider>;
}
```

**A three-pane screen.** The folder list and the reading pane are the
host's; the message list is a data view with the folder as its filter, no
frame, the host's buttons in the toolbar and its state under `list.`:

```tsx
import type { FilterNode } from "@jsudc/core";
import { UdcDataView } from "@jsudc/react";
import { useState } from "react";
import "@jsudc/react/styles.scoped.css";

const FOLDERS = ["inbox", "sent", "archive"] as const;

export function Mail() {
  const [folder, setFolder] = useState<(typeof FOLDERS)[number]>("inbox");
  const inFolder: FilterNode = { field: "folder", op: "eq", value: folder };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 1fr", height: "100vh" }}>
      <nav>
        {FOLDERS.map((f) => (
          <button key={f} aria-current={f === folder} onClick={() => setFolder(f)}>
            {f}
          </button>
        ))}
      </nav>

      <UdcDataView
        collection="messages"
        renderers={renderers} // createRendererRegistry(tableRenderer, messageList), see Renderers
        filter={inFolder}
        chrome={{ preset: "embedded", tabs: true }}
        pagingMode="infinite"
        urlPrefix="list."
        toolbarStart={<button onClick={() => compose()}>Compose</button>}
        toolbarEnd={<button onClick={() => syncMailbox()}>Sync</button>}
      />

      <article>{/* the host's reading pane */}</article>
    </div>
  );
}
```

The address bar then reads `/mail?list.q=invoice&list.sort=date:desc`, and a
parameter the host keeps for itself (`?folder=`, `?q=`) stays untouched.
Opening a row in the reading pane is
[row activation](#row-activation-and-keyboard).

## Row activation and keyboard

A row can do something of the host's: open the message in the reading pane.
`UdcDataView` takes three props, all optional; passing any of them turns
activation on, and without them the rows are what they were (no tab stop, no
keys, no active row, a `row_link` still followed on click):

| Prop                     | What it does                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `onRowActivate(row)`     | called on Enter on a row and on a plain click of it (the main button, no modifier, not on a link, button or input in it)                               |
| `activeRowId`            | the row drawn as active. Passed: controlled (`null` for none), the host moves it in `onActiveRowChange`. Left out: the view keeps it itself            |
| `onActiveRowChange(row)` | the active row changed by the user: moved by the keys (no Enter needed), or a click on another row (just before `onRowActivate`). Preview on move here |

**Keys**, in the table and the cards, while the focus is on a row:
ArrowDown / `j` and ArrowUp / `k` move the active row (and the focus) by one,
Home / End jump to the first / last loaded row, Enter activates. They are
left alone while an input, the search box, a cell editor, a menu, a list box
or a dialog has the focus, and with Ctrl, Cmd, Alt or Shift held. Space is
not bound unless the view selects; then it toggles the active row (0.5.0). Double-click and Enter still
edit an editable cell when the focus is on the cell itself.

**One tab stop.** The rows are a roving-`tabindex` list: Tab reaches the
active row (else the one last focused, else the first) and leaves the list on
the next Tab. The table is `role="grid"`; the card grid too, each card a
`row`. The active row has `aria-selected="true"` (while the view selects,
`aria-selected` is the selection and the active row has `aria-current`: see
[Selection and bulk actions](#selection-and-bulk-actions)), the attribute
`data-active="true"` (`.udc-row[data-active]`, `.udc-card[data-active]` for
your CSS) and the `--selected` background.

**Kept by id.** The active row and the focus follow the row's id across a
refetch, a sort and pages loading in infinite mode; ArrowDown on the last
loaded row in infinite mode loads the next page and moves onto its first
row; the active row is scrolled into view, also when the host sets
`activeRowId`. A row that left the list (deleted, filtered out) stops being
active without an error; when it comes back it is active again.

**`row_link`.** Without `onRowActivate` a click follows the view's
`row_link` as before. With it a plain click activates the row, and Cmd /
Ctrl-click and the middle button still open the link (in a new tab).

A list and a reading pane side by side, the pane following the keyboard: the
arrows preview, Enter or a click opens (marks the message read):

```tsx
import type { Row } from "@jsudc/core";
import { UdcDataView } from "@jsudc/react";
import { useState } from "react";

export function Mailbox() {
  const [open, setOpen] = useState<Row | null>(null);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", height: "100vh" }}>
      <UdcDataView
        collection="messages"
        chrome="embedded"
        pagingMode="infinite"
        // Controlled: the open message is the active row, so the pane and the list agree.
        activeRowId={open?.__meta.id ?? null}
        onActiveRowChange={setOpen} // ArrowDown / j: the pane previews the next message
        onRowActivate={(row) => {
          setOpen(row);
          void markRead(row.__meta.id); // Enter or a click: the host's own action
        }}
      />
      <article aria-live="polite">
        {open ? (
          <>
            <h2>{String(open.subject)}</h2>
            <p>{String(open.from)}</p>
          </>
        ) : (
          <p>No message selected</p>
        )}
      </article>
    </div>
  );
}
```

Leave `activeRowId` out and the view keeps the active row itself (across
tab switches too); pass only `onRowActivate` when moving should not open
anything.

**In a host renderer.** `UdcDataView` hands a renderer the same three props
(see [the contract](#writing-a-renderer-the-rendererprops-contract)), and
`useRowActivation` of `@jsudc/react/headless` (also on the root) gives it the
table's behaviour: spread `rowProps(row)` on each row's element (ref,
`tabIndex`, `aria-selected`, `data-active`, the key and focus handlers) and
call `handleClick(e, row)` from its `onClick`:

```tsx
import type { RendererProps } from "@jsudc/react";
import { useRowActivation } from "@jsudc/react/headless";

function MessageList({ data, onRowActivate, activeRowId, onActiveRowChange }: RendererProps) {
  const nav = useRowActivation({
    rows: data.rows,
    onRowActivate,
    activeRowId,
    onActiveRowChange,
    // Infinite mode: moving past the last row loads the next page.
    hasNextPage: data.hasNextPage,
    isFetchingNextPage: data.isFetchingNextPage,
    fetchNextPage: data.fetchNextPage,
  });
  return (
    <ul role={nav.enabled ? "grid" : undefined}>
      {data.rows.map((row) => (
        <li
          key={row.__meta.id}
          role={nav.enabled ? "row" : undefined}
          {...nav.rowProps(row)}
          onClick={(e) => nav.handleClick(e, row)}
        >
          {String(row.subject)}
        </li>
      ))}
    </ul>
  );
}
```

`nav.activeRowId` is the active row (when it is loaded), `nav.move("next")`
and `nav.activate(row)` drive it from the host's own buttons, and `ownsKeys`
says whether a key belongs to the element it was pressed on.

## Search answered by the source

The search box filters in the browser's terms by default: its text becomes
`contains` over the view's `search.fields`, or-ed, and is ANDed with the chips
and the filter tree. When a collection's `describe` says
`capabilities.search: "source"` (a `postgres_table` with a `tsvector`, a
collection backed by OpenSearch; see `@jsudc/server`'s "Search answered by the
source"), the data view sends the text as `search` in `list` instead and
composes nothing for it:

- **The paged list** carries `search` next to the filter (the host's filter,
  the chips, the tree), and so does its query key, so every text is its own
  cache entry. A blank box sends no `search`.
- **Renderers that load their own rows** get the text as `listSearch` (and a
  `filter` / `baseFilter` without it). Kanban, calendar, map, chart and tree
  pass it on; a tree that highlights what it loaded
  (`on_search: highlight_and_expand`) keeps searching in the browser. A renderer of your
  own passes it as `search` to `useUdcAllRows` or `useUdcCollection`.
- **Relevance order.** With a search and no sort chosen, the request has no
  sort and the source answers by relevance, so no column shows a sort
  indicator. Clicking a header still sorts, and the sort is sent with the
  search.
- **The selection** is cleared by a new search text, as by a new filter.
  "Select all that match" is not offered while a source search is active:
  `mutate_many` by filter cannot carry the search, so it could not name the
  same rows. The bar says so instead ("Only the loaded rows can be selected
  while searching"); the loaded rows can still be selected and acted on.
- The rest of the box is unchanged: the debounce, `?q=` in the URL, and the
  clear button.

Nothing changes for a host: the capability comes from the server, and a
collection without it sends exactly the requests it sent before.

```tsx
import { useUdcAllRows, type RendererProps } from "@jsudc/react";

// A renderer of your own that loads its rows: pass the source's search on.
function Timeline({ collection, describe, filter, listSearch }: RendererProps) {
  const { rows } = useUdcAllRows({
    collection,
    filter, // no `contains` for the box under the capability
    search: listSearch, // undefined without it, or with an empty box
    capabilities: describe.capabilities,
  });
  return (
    <ol>
      {rows.map((r) => (
        <li key={r.__meta.id}>{String(r.subject)}</li>
      ))}
    </ol>
  );
}
```

## Live updates

By default a view refreshes on a timer: the view's `refresh_interval_ms`
becomes the list's polling interval, and nothing at all without it. A server
with the change feed (`@jsudc/server`'s "Change feed": `createChangeFeed()`
passed as `changes` to `createDispatcher`) says `capabilities.changes: true`
on its collections and serves one Server-Sent Events stream for a list of
collections (`UdcClient.changes` in `@jsudc/core`). Turn it on in the
provider and the views refetch when the server says their rows changed:

```tsx
import { UdcClient } from "@jsudc/core/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { createUdcQueryClient, UdcDataView, UdcProvider, useUdcChanges } from "@jsudc/react";
import { RENDERERS } from "@jsudc/react/all";
import { useState } from "react";

const client = new UdcClient({ httpUrl: "" });
const queryClient = createUdcQueryClient({ onUnauthenticated: () => location.assign("/login") });

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* `changes`: one stream for the collections on screen. Off by default. */}
      <UdcProvider client={client} renderers={RENDERERS} changes>
        <InboxBadge />
        {/* Mark a message read in another tab: this list refetches within a moment. */}
        <UdcDataView collection="messages" />
      </UdcProvider>
    </QueryClientProvider>
  );
}

// A host's own counter: every insert the feed reports, as it arrives.
function InboxBadge() {
  const [unseen, setUnseen] = useState(0);
  const { status } = useUdcChanges("messages", (event) => {
    if (event.op === "insert") setUnseen((n) => n + (event.ids?.length ?? 1));
  });
  return (
    <button type="button" onClick={() => setUnseen(0)} title={status}>
      Inbox {unseen > 0 ? `(${unseen})` : null}
    </button>
  );
}
```

What happens:

- **One stream per provider.** A collection joins the stream when the first
  view or hook that shows it mounts (the data view, `useUdcCollection`,
  `useUdcAllRows`, `useUdcLookup` / `useUdcLookups` and `useLookupOptions`
  for the collection a lookup points to, `useUdcChanges`) and leaves it when
  the last one unmounts. A new list opens a new stream; the old one is closed
  only once the new one is subscribed, so the collections that stay miss
  nothing. Mounts close together (`batchMs`, 50 ms) make one reopen.
- **On an event** (`{ collection, op, ids? }`, no row data) the collection's
  lists, the lookup batches into it (the labels other views show) and its
  picker options are invalidated, so what is on screen refetches. A burst is
  debounced into one refetch (`debounceMs`, 200 ms), held back while a
  mutation of yours is in flight. A `delete` that names its `ids` takes those
  rows out of the cached lists at once (`removeDeleted: false` turns that
  off); nothing else is applied without the server's answer: a row is never
  synthesised from an event.
- **On "reconnected"** (the stream dropped and is back) everything the stream
  carries is refetched: changes made meanwhile were not sent. A collection
  that joins the stream is refetched when its data was fetched before the
  stream was asked for.
- **Polling is the fallback.** While the stream carries a collection its
  `refresh_interval_ms` timer is suspended; it runs again while the stream
  reconnects, when the server refused it, and always without a feed. An
  unauthenticated stream goes to `createUdcQueryClient`'s
  `onUnauthenticated` (in the same burst as failed queries) and is not
  reopened until the set of collections changes.
- **What stays put** across such a refetch: the active row and the focus, the
  selection, an open cell editor (and what was typed in it), the scroll
  position of an infinite list. The rows are replaced under them, by id.
- **The indicator.** Beside the freshness pill the data view shows "live"
  while the stream carries its collection and "reconnecting" while it is
  being reopened (`FEED_LIVE`, `FEED_RECONNECTING` and their `_HINT`
  tooltips, `en` and `sr`); `liveIndicator={false}` hides it, and
  `LiveIndicator` draws it in a toolbar of your own.

`changes` also takes `UdcChangeFeedOptions`: `debounceMs`, `batchMs`,
`removeDeleted`, and `minDelayMs`, `maxDelayMs`, `idleTimeoutMs` passed to
`UdcClient.changes`. A `UdcProvider` without `changes` inside one with the
same client uses the outer feed; `changes={false}` turns it off below.

**When the user behind the client changes** (0.5.1). The server runs the plugin's
`context` once, when a stream opens, and keeps that scope for the life of the
stream. With `headers` as a function (`new UdcClient({ headers: () => ({
"x-user": current }) })`: a demo user switcher, an account switcher,
impersonation) a switch leaves the collections on screen as they were, so
nothing would reopen the stream: the new user would hear the old user's
events and miss their own. Tell the provider who the stream is for:

```tsx
<UdcProvider client={client} changes={{ identity: user }}>
  <Routes />
</UdcProvider>;
```

When `identity` changes (compared with `Object.is`: pass an id, not a new
object per render) the provider calls `reconnect()` on its feed: the stream
is closed at once and reopened for the same collections, `headers` read
again; meanwhile the views say `reconnecting` and poll, and once it is open
what was fetched before the switch is refetched. Nothing below the provider
remounts, so component state survives (no `key={user}` needed). The same is
`useUdcChangeFeed()?.reconnect()` from your own code, which also asks again
for a stream the server refused (after signing in again). For full control,
provide a feed of your own through `UdcChangeFeedContext` (`new
UdcChangeFeed(client, options)`, one per user, `close()` it when replaced);
a `UdcProvider` below it with the same client and without `changes` uses it.

`useUdcChanges(collection, onEvent?, { capabilities?, enabled? })` answers
`{ status, live }`: `off` (no feed, or the collection does not offer it),
`connecting`, `live`, `reconnecting`, or `down` (refused). It reads the
capability from the collection's cached `describe` unless you pass
`capabilities`.

**Without the feed** nothing changes: a provider without `changes` opens no
connection and asks no `describe` for it, a collection whose `describe` does
not say `capabilities.changes: true` is never subscribed, and every view
polls on `refresh_interval_ms` (or not at all) exactly as before.

## Selection and bulk actions

A user selects rows (one, a range, the page, or everything that matches the
filter) and runs the view's `bulk_actions` on them. Selection is on when the
view says `multiselect: true` or declares `bulk_actions`; `selectable` on
`UdcDataView` forces it on (`true`) or off (`false`). A view with neither
draws exactly what it drew before 0.5.0.

**What the user does.** The table gets a checkbox column pinned at the start
and a header checkbox for the page (checked, empty or indeterminate);
shift-click selects the range from the last row toggled; with row activation
on, Space toggles the active row and Shift+Space selects a range to it. The
cards get a checkbox each. Kanban, tree, calendar, map and chart do not
select. While anything is selected a bar over the list shows the count, a
button per `bulk_actions` entry and a clear button.

**All that match.** When the whole page is selected and more rows match than
are loaded, the bar offers "Select all 1,234 that match". Taking it switches
the selection to "every row the filter matches, except the ones you uncheck"
(the bar reads "All 1,234 are selected"), and an action then goes to the
server by filter, not by ids. When everything is loaded already the page is
everything, and nothing is offered.

**The selection is cleared** when the filter changes (the search, a chip,
the filter builder, the host's `filter`) or the collection does (under a
source search, see [Search answered by the source](#search-answered-by-the-source),
"all that match" is not offered); a sort, a
refetch and more pages loading keep it. In id mode the selected rows are
remembered, so a row a refetch drops still counts and still reaches a
handler.

**Without a total.** A source answering `capabilities.total_count: false`
lists with `total: null`. The offer then reads "Select all that match", with
no number, the bar "All matching rows are selected", with no number, and the
result message reports the count the server answers (`updated`).

### Running an action

Each `bulk_actions` entry is an `ActionDef` of `@jsudc/core`: `kind`,
`label`, `icon` (`lucide:<name>`), `variant`, `when`, and 0.5.0's `set`,
`action` and `confirm`. Its button reads the term `ACTION_<KIND>` of the
collection's section (`TBL_<COLLECTION>`), else `ACTIONS.<kind>`, else the
def's `label`. It is disabled unless its `when` holds for every selected row
(`isActionEligibleForAll`); in "all that match" mode rows that are not loaded
cannot be checked in the browser, so it is offered unless `when` is `false`
and the server decides.

A click runs the first of these that applies:

1. **A handler for its `kind`**: the view's `actions` prop, else
   `UdcProvider actions`. It gets `{ kind, def, collection, ids }` in id mode
   or `{ kind, def, collection, filter, exceptIds }` in "all that match" mode,
   with `rows` (the selected rows that are loaded) and `clearSelection`. The
   view does not clear the selection after a handler; call `clearSelection`
   when you are done. A handler that throws shows its message.
2. **`delete`**: a confirmation, then `mutate_many` `delete`.
3. **A def with `set`**: `mutate_many` `update` with that patch.
4. **Anything else**: the server action the def's `action` names (default its
   `kind`) with `{ collection, ids }` or `{ collection, filter, except_ids }`
   — a host action registered on the dispatcher (`@jsudc/server`'s
   `Dispatcher.register`). An `unsupported_op` answer shows "The server does
   not support …", naming the action.

The built-in paths ask first when `actionConfirms(def)` says so: `delete` by
default, any other def with `confirm: true` or a question of its own. They
change the loaded rows at once (`useUdcMutateMany`), put them back if the
call fails, refetch the collection's lists and lookups when it settles, and
report what the server answers: "12 rows deleted", "Mark read: 12 rows", and
"3 rows could not be changed" for the ids in `failed`, which stay selected.

A mailbox whose view archives through the host's own endpoint, marks read
with a patch, and deletes with the built-in delete:

```yaml
# The view of `messages`
view:
  columns: [{ field: subject }, { field: from }, { field: received_at }]
  bulk_actions:
    - kind: archive
      label: Archive
      icon: lucide:archive
    - kind: mark_read
      label: Mark read
      icon: lucide:mail-open
      set: { read: true }
      when: { field: read, op: eq, value: false }
    - kind: delete
      variant: destructive
```

```tsx
import { UdcDataView } from "@jsudc/react";

export function Inbox() {
  return (
    <UdcDataView
      collection="messages"
      filter={{ field: "folder", op: "eq", value: "inbox" }}
      actions={{
        // Id mode: `ids`. "All that match": `filter` (the host's folder, the search, the chips)
        // and `exceptIds`. `rows` are the selected rows the view has loaded.
        archive: async ({ ids, filter, exceptIds, clearSelection }) => {
          await fetch("/api/mail/archive", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(ids ? { ids } : { filter, except_ids: exceptIds }),
          });
          clearSelection();
        },
        // mark_read has `set`: a mutate_many update, no handler needed.
        // delete is built in: a confirmation, then a mutate_many delete.
      }}
    />
  );
}
```

**Accessibility.** With selection on and row activation off the table stays a
table: each row's checkbox is a native checkbox labelled "Select row", the
header's "Select all rows shown" (`aria-checked="mixed"` when some are). With
both on the list is ARIA's multi-select grid (`aria-multiselectable="true"`):
`aria-selected` on a row says whether it is **selected**, and the active row
is the one holding the focus (the roving tab stop), marked
`aria-current="true"` and `data-active="true"`. With selection off,
`aria-selected` marks the active row as in 0.4.0. A selected row carries
`data-selected="true"` (`.udc-row[data-selected]`, `.udc-card[data-selected]`)
and the `--selected` background; the bar is `role="toolbar"` and its count is
announced politely.

**In a host renderer.** `RendererProps.selection` (a `RowSelection`, set
while the view selects) carries `mode`, `ids`, `exceptIds`, `count`
(`null` in "all that match" mode without a total), `rows`, `pageState`,
`isSelected(id)`, `toggle(id, { range })`, `setPage(on)`,
`selectAllMatching()`, `setIds(ids)` and `clear()`; the view draws the bar.
`useRowSelection({ rows, total, resetKey })` of `@jsudc/react/headless` is
the same model for a list of your own, and its pure operations
(`toggleSelection`, `selectRange`, `setPageSelection`, `selectAllMatching`,
`selectionCount`, …) range over the rows as loaded, not over the DOM.
`useRowActivation` takes `isSelected` and `onToggleSelect(row, range)` for
Space and the ARIA above.

### `useUdcMutateMany` and `useUdcAction`

`useUdcMutateMany(collection)` is `useUdcMutate` for many rows: `mutateAsync({
op: "update", ids, row })`, `{ op: "delete", ids }`, or by `filter` with
`except_ids`. The rows it touches are patched (or removed, the total counted
down) in every cached list at once, put back on an error, and the lists and
lookups are invalidated when it settles. It resolves to the server's `{
updated, failed }`: report `failed` yourself.

`useUdcAction(action)` is a mutation over the client's typed `call` for any
host action. Given the action's definition (`defineHostAction`, in a module
the server and the browser share), the payload and the answer are typed from
its schemas and the answer is checked; given a name, you type it
(`useUdcAction<Res, Req>("mail.flag")`). `invalidates` names the collections
whose lists to refetch afterwards; every other TanStack mutation option
passes through.

```ts
// shared/actions.ts — imported by the server (Dispatcher.register) and by the browser
import { defineHostAction } from "@jsudc/core";
import { z } from "zod";

export const snooze = defineHostAction({
  name: "mail.snooze",
  request: z.object({ ids: z.array(z.string()), until: z.iso.datetime() }),
  response: z.object({ snoozed: z.number().int() }),
});
```

```tsx
import { useUdcAction } from "@jsudc/react";
import { snooze } from "../shared/actions";

export function SnoozeButton({ ids }: { ids: string[] }) {
  const run = useUdcAction(snooze, { invalidates: ["messages"] });
  return (
    <button
      type="button"
      disabled={run.isPending}
      // The payload is typed { ids: string[]; until: string }; data is { snoozed: number }.
      onClick={() => run.mutate({ ids, until: new Date(Date.now() + 3_600_000).toISOString() })}
    >
      {run.data ? `Snoozed ${run.data.snoozed}` : "Snooze an hour"}
    </button>
  );
}
```

## Row actions

Each row offers the actions its view declares for one row, as icon buttons at
the end of the row or in a "more" menu, each only where its `when` holds for
that row. They run exactly as a bulk action does on a selection of that one
row: the same handlers, the same server paths. A view that declares none
draws exactly what it drew before 0.5.0.

**What a row offers.** The three keys are udc's, read as udc-js reads them:
`row_action_defs` (a list of `ActionDef`, the shape of `bulk_actions`) when
the view has any, else the kinds of the legacy `row_actions: string[]`
lifted to `{ kind }`. Each is filtered by its `when` for that row
(`isActionEligible` of `@jsudc/core`: against `row.__meta.state` when the
source sends one, else the row's fields). A row none of whose actions apply
shows nothing.

**How they are drawn**, by `row_actions_display`:

- `inline` (the default, as in udc-js): the table gets a trailing column
  pinned at the end (after any column pinned right) with one icon button per
  action, labelled for screen readers and in a tooltip; an action whose
  `icon` is not known draws its label as a small text button. The column is
  sized from every declared action, with the `when`-gated ones counted as
  alternatives (only the widest), so it does not jump as rows change.
- `menu`: one "more" button per row opening a dropdown, and the same menu on
  right-click anywhere on the row.

The cards draw the same actions as a "more" menu on each card (right-click
opens it too), whatever the display. Kanban, tree, calendar, map and chart
draw no row actions.

**The keyboard.** With row activation on, the focused row opens its menu from
the context-menu key, Shift+F10 or `.` (`isRowMenuKey`); in the inline
display the keys open the same actions as a menu. Arrow keys move in the
menu, Enter runs, Escape closes, and the focus goes back to the row. Opened
from the "more" button, the focus goes back to that button.

**A click on an action is the action's**: it neither activates the row
(`onRowActivate`), nor follows its `row_link`, nor toggles its selection; a
click anywhere else on the row does what it did.

**Running one** goes through [Running an action](#running-an-action) with
`ids: [id]` and `rows: [row]`:

1. **A handler for its `kind`** (the view's `actions`, else `UdcProvider
   actions`): it gets the bulk context with `ids: [id]`, `rows: [row]` and
   `row`, the one row (absent when the bulk bar runs it). `clearSelection`
   clears the view's selection, if it selects.
2. **`delete`**: a confirmation ("Delete this row?"), then `mutate_many`
   `delete` when the source has `capabilities.mutate_many`, else `mutate`
   `delete`. The row leaves the list and the selection.
3. **A def with `set`**: an update with that patch (`mutate_many` or
   `mutate`), shown at once and put back if the call fails.
4. **Anything else**: the server action the def's `action` names (default its
   `kind`) with `{ collection, ids: [id] }`.

As for a bulk action, the built-in paths ask first per `confirm`, a handler
asks its own questions, and an error (or the row named in a `failed` answer)
is shown as a toast. A row action names its button with the term
`ACTION_<KIND>` of the collection's section, else `ACTIONS.<kind>`, else the
def's `label`, else the kind made readable.

A mailbox whose rows mark themselves read through a patch and archive through
the host's own endpoint, each hidden where it does not apply:

```yaml
# The view of `messages`
view:
  columns: [{ field: subject }, { field: from }, { field: received_at }]
  row_actions_display: inline # or `menu`
  row_action_defs:
    - kind: mark_read
      label: Mark read
      icon: lucide:mail-open
      set: { read: true } # no handler needed: an optimistic update
      when: { field: read, op: eq, value: false }
    - kind: archive
      label: Archive
      icon: lucide:archive
      when: { field: folder, op: neq, value: archive }
```

```tsx
import { UdcDataView } from "@jsudc/react";

export function Inbox() {
  return (
    <UdcDataView
      collection="messages"
      filter={{ field: "folder", op: "eq", value: "inbox" }}
      onRowActivate={(row) => openMessage(row.__meta.id)}
      actions={{
        // The same handler serves the bulk bar (`ids` of the selection, or `filter`) and the row
        // ("archive" on one row: `ids: [id]`, `rows: [row]`, `row`).
        archive: async ({ ids, filter, exceptIds, row, clearSelection }) => {
          await fetch("/api/mail/archive", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(ids ? { ids } : { filter, except_ids: exceptIds }),
          });
          if (!row) clearSelection();
        },
      }}
    />
  );
}
```

An unread message in the inbox shows both; a read one only "Archive"; a read
one already archived, none. Clicking "Mark read" shows the row read at once (and so
"Mark read" goes from it); clicking the row itself still opens the message.

**In a host renderer.** `RendererProps.rowActions` (a `RowActions`, set when
the view declares row actions) carries `display`, `defs` (every declared
action, before `when`), `eligible(row)`, `label(def)`, `run(def, row)` (the
path above; it shows its errors and does not reject) and `runningOn(id)`
(the kind running on that row, else `null`). `RowActionsControls` with
`useRowMenu()` draws the built-in buttons and menu; `rowMenuHandlers` gives a
row element its menu key and right-click. The headless parts —
`rowActionDefs(view)`, `rowActionsDisplay(view)`, `eligibleRowActions(defs,
row)`, `isRowMenuKey(e)` — are in `@jsudc/react/headless`. A UI kit's
`DropdownMenu` may take the optional `open` / `onOpenChange` and its content
`onCloseAutoFocus` (the default kit does); a kit that ignores them still
opens the menu from its trigger, but not from the keys or a right-click.

## Long lists

In infinite mode the table mounts only the rows in and near its viewport,
however many pages are loaded: a mailbox scrolled through for thousands of
messages keeps a few dozen `<tr>` in the page, not thousands. The rows
outside the window are stood in for by spacer rows of their height, so the
scrollbar, the scroll position and the sticky header behave as if every row
were there. Rows have one height (the view's `row_height`, default 40 px),
so the window is arithmetic: no dependency, no measuring of each row.

**When it applies.** Only in infinite mode (pages mode is never windowed)
and, by default, only once **more than 200 rows** are loaded: a list at or
under that draws exactly the markup it drew before 0.5.0. The `virtualize`
prop of `UdcDataView` (and of `TableRenderer`) changes that:

| `virtualize`                       | Infinite mode windows its rows…                    |
| ---------------------------------- | -------------------------------------------------- |
| left out, or `{ enabled: "auto" }` | once more than `threshold` (200) rows are loaded   |
| `true` / `{ enabled: true }`       | always, however few                                |
| `false` / `{ enabled: false }`     | never: every loaded row is mounted, as before      |
| `{ threshold: 500 }`               | once more than 500 are loaded                      |
| `{ overscan: 20 }`                 | with 20 rows mounted beyond each edge (default 10) |

```tsx
import { UdcDataView } from "@jsudc/react";

// The mailbox: always infinite, always windowed (even a short folder), with a deeper overscan
// for fast keyboard scrolling.
export function Mailbox({ folder }: { folder: string }) {
  return (
    <UdcDataView
      collection="messages"
      filter={{ field: "folder", op: "eq", value: folder }}
      pagingMode="infinite"
      virtualize={{ enabled: true, overscan: 20 }}
      onRowActivate={(row) => openMessage(row.__meta.id)}
    />
  );
}
```

With 5 000 messages loaded this mounts about 40 rows (the ~10 that show, 20
above and 20 below); scrolling moves the window, and reaching the end of the
loaded rows loads the next page as before.

**What keeps working across the window.**

- The sticky header, pinned columns and their shadows, column widths and
  horizontal scroll: the spacers span every column.
- The infinite sentinel: it sits under the full height of the rows, so it
  comes into view at the end of the loaded rows and asks for the next page.
- The keys of row activation: ArrowDown / ArrowUp / `j` / `k` onto a row
  outside the window scroll it in (to the nearest edge), mount it and focus
  it; Home and End go to the first and the last loaded row. A row is kept
  mounted, wherever it is, while it is the active row, holds the list's tab
  stop or has the focus, so it keeps the focus when it is scrolled away and
  back.
- Selection: a shift-range and "select the page" are computed over the
  loaded rows, never the mounted ones, so a range spanning rows that were
  never drawn selects them all.
- An open cell editor: its row stays mounted while the editor is open (the
  edit is neither committed nor cancelled by scrolling), and a row whose
  "more" menu is open stays mounted too.
- Row actions, custom cells and lookups: a lookup column still makes one
  fetch for every loaded row, not one per window.
- A refetch from the change feed keeps the scroll position: the window
  follows `scrollTop`, which a refetch of the same pages does not change.
- `aria-rowcount` on the table is the loaded count and every mounted row
  carries its `aria-rowindex` (1-based, over the loaded rows), so a screen
  reader hears "row 2 501 of 5 000" for a row it could not otherwise place.

**Limits.** The browser's find-in-page (Ctrl / Cmd+F) sees only the mounted
rows; search the list with the view's search box instead. Printing prints
the window, not the list. Rows of variable height are not supported (a row
taller than `row_height` is measured once and its height used for all), and
the cards, kanban and tree renderers are not windowed.

**In a host renderer.** The arithmetic is in `@jsudc/react/headless`:
`virtualizationApplies(virtualize, mode, count)`,
`resolveVirtualization(virtualize)` (with `DEFAULT_VIRTUAL_THRESHOLD`,
`DEFAULT_VIRTUAL_OVERSCAN`), `visibleRange`, `withOverscan`, `keepRange`,
`bodySlices(count, range, pinned)` and the hook `useRowWindow`. A windowed
list of your own passes `reveal(row, index)` to `useRowActivation`: the keys
call it for a row that is not mounted, and the row takes the focus the
moment its element attaches. `RendererProps.virtualize` carries the view's
prop when the host set it.

## Custom cells

A column of the table can be drawn by a component of the host's. Register
cell components by name, the way renderers are registered, and name one in
the column's `render`:

```yaml
view:
  columns:
    - field: from
      render: sender # the host's component
      render_options: { avatar: true }
    - field: label
      render: badge # built in, unless the host registered "badge"
```

`render: "<name>"` resolves from the host's registry first, then from the
built-in kinds (`bool`, `badge`, `sparkline`, `heading_glyph`, `icon`,
`date`, `datetime`, `number_format`, `bytes`, `text`); a name nobody
registered behaves as before (the field type's kind). Registering a built-in
name replaces that kind for every column that names it in `render` (a
column that only inherits a kind from its field type keeps the built-in).
The cards draw their meta fields through the same registry; the other
renderers (the kanban's, the calendar's, the map's and the chart's details)
keep the built-in kinds.

A cell component receives `CellProps`, a public contract like
`RendererProps`:

| Prop                   | Type                    | What it is                                                                                |
| ---------------------- | ----------------------- | ----------------------------------------------------------------------------------------- |
| `value`                | `unknown`               | `row[column.field]` as the server sent it; blank values too (draw your own empty)         |
| `row`                  | `Row`                   | the whole row, `__meta` (id, version) included                                            |
| `column`               | `ColumnConfig`          | the column from `view.columns[]` (or the card's meta field): `render_options`, `align`, … |
| `def`                  | `FieldDef \| undefined` | the field's definition in the schema                                                      |
| `collection`           | `string`                | the collection's name                                                                     |
| `locale`, `intlLocale` | `string`                | the UI's language and its `Intl` locale                                                   |
| `editable`             | `boolean`               | the cell edits on double-click (the inline editor draws over your component)              |
| `surface`              | `"table" \| "card"`     | a table cell or a card's meta field                                                       |

```tsx
import { type CellProps, createCellRegistry, UdcDataView, UdcProvider } from "@jsudc/react";

/** The sender as an avatar and a name, the unread ones bold. */
function SenderCell({ value, row, column }: CellProps) {
  const name = String(value ?? "");
  return (
    <span style={{ display: "flex", gap: 6, fontWeight: row.unread ? 600 : 400 }}>
      {column.render_options?.avatar ? (
        <img src={`/avatars/${name}.png`} alt="" width={20} />
      ) : null}
      {name || "—"}
    </span>
  );
}

// A module constant, like the renderer registry.
const cells = createCellRegistry({ name: "sender", component: SenderCell });

<UdcProvider client={client} renderers={renderers} cells={cells}>
  …
</UdcProvider>;

// Or for one view, added to the provider's (this view's names win):
<UdcDataView collection="messages" cells={cells} />;
```

`createCellRegistry` takes `{ name, component }` definitions, a later one
replacing an earlier name; a plain `{ sender: SenderCell }` object is a
registry too. `UdcCellsProvider cells={…}` sets one anywhere in the tree
(nested providers add up, the inner names winning) and `useCellRegistry()`
reads the one in effect; `CellValue` of `@jsudc/react/table` draws with it
when passed `cells`, `row` and `collection`.

## Bring your own primitives

The renderers never import a button, a dialog or a menu. They take every
primitive from a **UI kit** in context: `const { Button, Popover } = useUiKit()`.
The kit the package ships, Radix primitives styled with Tailwind, is
`defaultUiKit` from `@jsudc/react/ui`, and it is what the view uses when you
pass nothing. Hand another kit to `UdcProvider` (or mount `UdcUiProvider`
yourself) to draw the same view with MUI, Ant Design, or your own shadcn
components:

```tsx
import { UdcProvider } from "@jsudc/react";
import { myKit } from "./myKit"; // a module constant: `const myKit: UiKit = {...}`

<UdcProvider client={client} kit={myKit}>
  <myKit.TooltipProvider>
    <myKit.Toaster>
      <UdcDataView collection="companies" />
    </myKit.Toaster>
  </myKit.TooltipProvider>
</UdcProvider>;
```

`UdcProvider` without `kit` leaves the kit alone: an outer `UdcUiProvider`'s
wins, else the default. `useUiKit()` returns the kit in effect, so your own
components can draw with the same primitives.

**The contract** is the `UiKit` interface (exported from the package root
with one props type per primitive, `UiButtonProps`, `UiDialogContentProps` and
so on). It lists exactly the props the renderers pass, no more:

| Family  | Members                                                                                                                                             |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fields  | `Button` (`variant`, `size`), `Input`, `NativeSelect`, `Checkbox`, `Select` (an options list), `Segmented`                                          |
| Small   | `Spinner`, `Skeleton`, `Kbd`                                                                                                                        |
| Dialog  | `Dialog` (controlled), `DialogContent` (`title`, `description`, a close button), `DialogBody`, `DialogFooter`                                       |
| Menu    | `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem` (`onSelect`, `tone`), `DropdownMenuLabel`, `DropdownMenuSeparator` |
| Popover | `Popover` (controlled or not), `PopoverTrigger`, `PopoverContent`, `PopoverAnchor` (a `virtualRef`)                                                 |
| Tooltip | `TooltipProvider`, `Tip` (`label` on its single child)                                                                                              |
| Toast   | `Toaster` (the stack and its viewport), `useToast()` → `{ toast({ title, description?, variant? }) }`                                               |

Three things a kit must honour: a trigger with `asChild` merges into its single
child instead of drawing a button; `DialogContent`'s `onEscapeKeyDown` /
`onInteractOutside` and `PopoverContent`'s `onOpenAutoFocus` get an event whose
`preventDefault()` keeps the dialog open or the focus in place; `useToast` is
called as a hook. Keep the kit object stable (a module constant): it is read on
every render.

**The smallest kit** is plain HTML. The package's own test suite has one,
[`test/stubKit.tsx`](test/stubKit.tsx), and renders every renderer with it;
a few of its members:

```tsx
import type { UiKit } from "@jsudc/react";

export const stubKit: UiKit = {
  Button: ({ variant, size, type, ...props }) => (
    <button data-variant={variant} data-size={size} type={type ?? "button"} {...props} />
  ),
  Input: (props) => <input {...props} />,
  Checkbox: ({ onCheckedChange, ...props }) => (
    <input type="checkbox" {...props} onChange={(e) => onCheckedChange(e.target.checked)} />
  ),
  Spinner: ({ className }) => <span aria-hidden className={className} />,
  Tip: ({ label, children }) => (
    <span title={typeof label === "string" ? label : undefined}>{children}</span>
  ),
  // … Dialog, DropdownMenu and Popover keep their open state in a small context;
  // see test/stubKit.tsx for all of it.
};
```

**The default kit's primitives** are exported one by one from
`@jsudc/react/ui` too (`Button`, `Dialog`, `DialogContent`, `Popover`,
`Select`, `Segmented`, `Toaster`, `useToast`, `Tip`, …), for a host page that
wants the same look outside the view. Radix (`radix-ui`) is still a required
peer while the default kit is the fallback.

## Peer dependencies

Everything the components import that a host is likely to have too is a peer,
so there is one copy of it in the bundle:

- `@jsudc/core` ^0.5.0 — one copy of the protocol, shared with the host's
  own `UdcClient`;
- `react`, `react-dom` ^19 — one React, or hooks break;
- `@tanstack/react-query` ^5 — one `QueryClient` context, shared with the
  host's own queries;
- `lucide-react` — the icons;
- `radix-ui` — the default UI kit (`@jsudc/react/ui`), the fallback when no
  other kit is given (see [Bring your own primitives](#bring-your-own-primitives));
- **optional**, each needed only by its subpath (see [Renderers](#renderers)):
  `@tanstack/react-table` (table), `@dnd-kit/core` (kanban, tree),
  `@dnd-kit/sortable` and `@dnd-kit/utilities` (kanban), `leaflet` (map),
  `recharts` (chart), `react-router` (`@jsudc/react/react-router`, see
  [URL state](#url-state)). The package root imports none of them.

The regular dependencies are `clsx`, `tailwind-merge` and `marked` (the Doc
tab).

The map renderer imports `leaflet/dist/leaflet.css` itself; your bundler picks
it up from the `leaflet` you installed.

## Styling

Import the compiled stylesheet once, with or without Tailwind of your own:

```ts
import "@jsudc/react/styles.css";
```

It holds Tailwind's preflight, every utility the components use, the design
tokens of both themes and the library's few rules of its own. Every utility is
**`udc:`-prefixed** (Tailwind v4's `prefix(udc)`: `udc:flex`,
`udc:hover:bg-hover`), so it cannot collide with a host's own Tailwind: a
host's `.flex` and `.p-4` are its own, and the library's are `.udc\:flex`,
`.udc\:p-4`. A host that runs Tailwind v4 keeps its build as it is and
imports `styles.css` beside it; it does not `@source` the package (its
classes are already compiled, and a host's unprefixed Tailwind would not
generate them anyway). The build fails if the stylesheet ever carries an
unprefixed class (`scripts/check-css.mjs`).

The stylesheet also carries the library's base rules (`border-color` on `*`,
`body` font and colours, pointer cursor on buttons) in `@layer base`; any
unlayered CSS of the host wins over them.

### The scoped sheet: a stylesheet that leaves the host alone

`styles.css` is made for a page that is the library's: its preflight resets
every `h1`, `button` and list of the page, its `body` rule sets the page's
font and colours, and its tokens sit on `:root`, where they overwrite a
host's own `--background` or `--primary`. A host that embeds a view in pages
of its own imports the scoped sheet instead (one of the two, not both):

```ts
import "@jsudc/react/styles.scoped.css";
```

It has the same utilities, tokens and resets, applied only inside the
library's roots: `.udc-data-view`, and `.udc-scope` (`UDC_SCOPE_CLASS`), which
the default UI kit puts on everything it portals out of the view (dialogs,
popovers, menus, selects, tooltips, toasts). There is no rule on `*`, `html`,
`body` or `:root`, no global preflight and no `@property` registration, so
the host's elements compute exactly the styles they computed before; the
build fails if a selector of the sheet could match an element outside a root
(`scripts/check-scoped-css.mjs`), and a test compares the computed styles of a
host's page with and without it in headless Chrome.

| Situation                                                                | Sheet               |
| ------------------------------------------------------------------------ | ------------------- |
| the page is the library's (an admin, a back office), or a new app        | `styles.css`        |
| the view is a pane of the host's own pages, with the host's own base CSS | `styles.scoped.css` |
| the host's tokens share the generic names (`--background`, `--primary`)  | `styles.scoped.css` |

What changes with it:

- **Theming:** the tokens are declared on the roots, at zero specificity
  (`:where(.udc-data-view, .udc-scope)`), so the host restyles the library on
  the roots, not on `:root`: `.udc-data-view, .udc-scope { --primary: …; }`.
  `.dark` on any ancestor (or on the root itself) switches both themes as
  before.
- **Components outside a view:** a `LookupCombobox` or a schema dialog
  rendered by the host outside `<UdcDataView>` needs a root around it:
  `<div className={UDC_SCOPE_CLASS}>…</div>`. A host-supplied UI kit that
  portals its own content does the same if that content relies on the
  library's sheet.
- **The background:** a root paints none; the view sits on the host's pane.
- **The cascade:** the resets are in `@layer base` and the utilities in
  `@layer utilities`, as in `styles.css`, so an unlayered element rule of the
  host (`button { background: … }`) still reaches inside the view. Put the
  host's own base styles in a layer, or scope them, if they should not.

### Theming

Every colour, radius and font comes from a CSS variable on `:root` and
`.dark` (with the scoped sheet: on the library's roots, see above).
Restyling is redefining them after the stylesheet, no code:

```css
:root {
  --primary: oklch(0.55 0.2 150);
  --primary-foreground: white;
  --radius: 0;
  --font-sans: Georgia, serif;
}
.dark {
  --background: oklch(0.12 0.01 150);
}
```

The variables (`dist/tokens.css`, both themes):

| Variable                                                                                                        | What it paints                                                        |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `--background`, `--foreground`                                                                                  | the page behind the view, the text                                    |
| `--surface`, `--surface-raised`                                                                                 | panels, cards, cells; popovers and dialogs                            |
| `--muted`, `--muted-foreground`                                                                                 | quiet fills (skeletons, column backgrounds), secondary text           |
| `--border`, `--border-strong`, `--input`, `--ring`                                                              | hairlines, emphasised borders, inputs, focus rings                    |
| `--primary`, `--primary-foreground`                                                                             | the accent: primary buttons, active chips, links                      |
| `--hover`, `--selected`                                                                                         | row and item hover, selection                                         |
| `--shadow-pin`                                                                                                  | the shadow beside a pinned table column                               |
| `--sem-accent`, `--sem-success`, `--sem-warning`, `--sem-danger`, `--sem-info`, `--sem-muted`                   | the semantic tones (badges, row colours, kanban columns, map markers) |
| `--sem-accent-bg`, `--sem-success-bg`, `--sem-warning-bg`, `--sem-danger-bg`, `--sem-info-bg`, `--sem-muted-bg` | their background pairs                                                |
| `--chart-1` … `--chart-8`                                                                                       | the chart's series                                                    |
| `--radius`                                                                                                      | the base corner radius; every `rounded-*` step is a multiple of it    |
| `--font-sans`, `--font-mono`                                                                                    | the UI font, the font of code and ids                                 |

Dark mode is the `dark` class on any ancestor, usually `<html>`. The default
`--font-sans` is `Inter Variable` when the host loads it
(`@fontsource-variable/inter`), else the system UI font. `--radius` defaults
to `0.5rem`: the steps are `sm` ½, `md` ¾, `lg` 1×, `xl` 1½× of it, so
`--radius: 0` squares every corner and `--radius: 1rem` doubles them. The
compiled utilities read these variables themselves (`var(--radius)`,
`var(--font-sans)`), so the stylesheet's internal `--udc-*` names are not
part of the theme.

### Stable classes

Next to its utilities every structural element carries a class that does not
change with them, for plain-CSS overrides:

| Class                | Element                                           |
| -------------------- | ------------------------------------------------- |
| `udc-data-view`      | the whole view (header, toolbar, the renderer)    |
| `udc-scope`          | a portalled dialog, popover, menu, tooltip, toast |
| `udc-toolbar`        | the toolbar: search, chips, filter builder, count |
| `udc-search`         | the search box                                    |
| `udc-filter-chip`    | one filter chip                                   |
| `udc-table`          | the table's `<table>`                             |
| `udc-row`            | a table row (`<tr>`)                              |
| `udc-cell`           | a table cell (`<td>`)                             |
| `udc-pager`          | the pager under the table or the cards            |
| `udc-card`           | one card of the card grid                         |
| `udc-kanban`         | the kanban board                                  |
| `udc-kanban-column`  | a kanban column                                   |
| `udc-kanban-card`    | a kanban card                                     |
| `udc-calendar`       | the calendar                                      |
| `udc-calendar-event` | an event (time grid block, month chip)            |
| `udc-tree`           | the tree                                          |
| `udc-tree-node`      | one node of the tree (with its children)          |
| `udc-map`            | the map's Leaflet container                       |
| `udc-chart`          | the chart tab                                     |
| `udc-schema-editor`  | the field form and the delete-field dialog        |

```css
/* Denser table rows, a bolder first column, square cards. */
.udc-table .udc-row {
  height: 28px !important; /* the row height is an inline style */
}
.udc-table .udc-row .udc-cell:first-child {
  font-weight: 600;
}
.udc-card {
  border-radius: 0;
}
```

With row activation on, the active row and card also carry
`data-active="true"` (`.udc-row[data-active] .udc-cell { … }`).

A rule of the host's own (unlayered) CSS wins over the library's utilities,
which sit in Tailwind's `@layer utilities`, without `!important`; only inline
styles (row height, column widths, pinned offsets) need it.

## i18n

`UdcI18nProvider` ships the library's strings (section `APP`) in `en` and `sr`.
`t(section, term)` looks in the field labels of the collection's schema first,
then in your `messages`, then in the library's dictionary, in the current
locale and then in English; a term found nowhere is humanised (`revenue_eur` →
`Revenue eur`).

```tsx
import { type Messages, UdcI18nProvider } from "@jsudc/react";

const messages: Messages = {
  // the collection's title, and its own field labels and strings
  COLLECTIONS: { COMPANIES: { en: "Companies", sr: "Preduzeća" } },
  TBL_COMPANIES: {
    __DESCRIPTION: { en: "Our customers", sr: "Naši klijenti" },
    REVENUE_EUR: { en: "Revenue (EUR)", sr: "Prihod (EUR)" },
  },
  // override one library string, in one locale
  APP: { RETRY: { en: "Reload" } },
};

<UdcI18nProvider messages={messages}>…</UdcI18nProvider>;
```

- Sections are `COLLECTIONS` (titles), `TBL_<COLLECTION>` (a collection's
  field labels — term = field name upper-cased — plus `__DESCRIPTION` under
  the title and `SEARCH_PLACEHOLDER`) and `APP`.
- **Another locale** is just strings in it: add `de` to the terms you translate
  and it is offered (`useI18n().locales` is `en`, `sr` and every locale your
  messages use); missing terms fall back to English. `Intl` formats with the
  locale tag as it is (`en` → `en-US` and `sr` → `sr-Latn-RS` are mapped).
- **Who owns the locale**: by default the provider does, remembered in
  `localStorage` (`udc-locale`). Pass `locale` and `onLocaleChange` to keep it in
  your own state, a URL or a user profile.
- `useI18n()` gives `t`, `tMaybe` (`null` when missing), `locale`,
  `intlLocale`, `locales` and `setLocale` to your own components too.

## Sessions

A host with a cookie session and a CSRF token uses the client as it is: the
`UdcClient` of `@jsudc/core` reads its `headers` per call when they are a
function, sends cookies to another origin with `credentials: "include"`, and
turns "not signed in" — an HTTP 401 in front of `/udc`, or the server's
in-protocol refusal (`forbidden`, `details.reason: "unauthenticated"`) — into
one error, `isUnauthenticated(err)`. That error is never retried. The library
does two things with it:

- **`createUdcQueryClient({ onUnauthenticated })`** calls your callback when a
  query or a mutation fails that way: the one place to send the user to your
  login. It is called once per burst — the failures that arrive together (every
  query of a page) make one call — and again only after
  `unauthenticatedQuietMs` (default 2000) without such a failure.
  `createUdcQueryClient()` without arguments works as before.
- **The error state** of every view says the user is signed out
  (`APP.SIGNED_OUT_TITLE`, `APP.SIGNED_OUT_BODY`, overridable like every other
  term) instead of the generic failure with Retry.

```tsx
import { UdcClient } from "@jsudc/core/client";
import { createUdcQueryClient, UdcDataView, UdcProvider } from "@jsudc/react";
import { RENDERERS } from "@jsudc/react/all";
import { QueryClientProvider } from "@tanstack/react-query";

// Django-style: the session cookie travels by itself, the CSRF token is a cookie
// the page reads and echoes in a header — read on every call, so a new session
// (and a new token) needs no new client.
const csrfToken = () => document.cookie.match(/(?:^|; )csrftoken=([^;]*)/)?.[1] ?? "";

const client = new UdcClient({
  httpUrl: "https://api.example.com",
  credentials: "include", // cookies to another origin; leave it out on the same origin
  headers: () => ({ "x-csrftoken": csrfToken() }),
});

const queryClient = createUdcQueryClient({
  // once, however many queries of the page were refused together
  onUnauthenticated: () => {
    const next = encodeURIComponent(location.pathname + location.search);
    location.assign(`/login?next=${next}`);
  },
});

<UdcProvider client={client} renderers={RENDERERS}>
  <QueryClientProvider client={queryClient}>
    {/* …the other providers of the quick start… */}
    <UdcDataView collection="messages" />
  </QueryClientProvider>
</UdcProvider>;
```

An HTTP 403 is `forbidden` with `details.http_status: 403`: also not retried,
shown as the generic failure, and not passed to `onUnauthenticated`. Login
screens, token refresh and storing the session are the host's.

## Lookups and drill-down

A `lookup` / `lookup_array` field (see `@jsudc/core`) holds the key of a row of
another collection. The library resolves the labels on the client; the server
only stores and filters keys.

- **The cell** shows the target's `label_field` as a link to the target
  collection filtered by that key (`?f=` with `{field: <key field>, op: eq}`),
  and the bare key until the label arrives or when no target row has it. A
  `lookup_array` is a row of such chips; `extra_fields` are the link's tooltip.
  Cards, the kanban card's detail and the calendar's event detail draw the same
  cell; the kanban card's avatars read the labels of an `assignees_field` that
  is a `lookup_array`. In an `editable` cell a plain click on a label stays in
  the cell (double-click edits) and Cmd / Ctrl-click opens the target. A filter
  pill on a lookup field shows the labels too.
- **One call per lookup field**, not per cell: the table (and the kanban
  board) resolve the keys of the rows on screen with `useLookupBatch` and hand
  them down through `<UdcLookupBatch>`. A `LookupValue` outside a batch
  resolves its own keys.
- **The `select` chip** over a lookup field lists the target's rows by label
  and filters by key (`in`). Up to 50 rows are listed as they are; a larger
  target gets a search box that asks the server (`contains` on `label_field`).
- **Inline edit**: an `editable` lookup column edits with a combobox that
  searches the target. On a `lookup` a pick writes the key ("none" clears it);
  on a `lookup_array` picks add and remove keys (Backspace removes the last),
  and Enter on an empty search writes the list. Escape cancels.
- **Drill-down**: a view with `row_link` opens the linked collection, filtered
  by a value of the clicked row, on a row click; Cmd / Ctrl-click and the
  middle button open a new tab. Rows show a pointer. A click in an editable
  cell, on a link or a control stays where it is (double-click still edits).
  A drill-down onto a kanban collection lands on the linked board: without a
  `?board=`, the board select (kanban and calendar) follows an `eq` on
  `kanban_options.ticket_board_field` in the filter.

```ts
const { row, rows, isLoading } = useUdcLookup("boards", ["b1", "b2"]); // keys are ids
const people = useUdcLookup(def.lookup, row.assignees as string[]); // a lookup block
```

`useUdcLookup(target, keys)` makes one `list` with an `in` filter over the
key field, cached under `["udc", "lookup", collection, sortedKeys]`; a write
to the target collection (`useUdcMutate`) invalidates it.

**Where links go.** The library has no routes of its own, so the host says
where a collection's view is mounted. Under react-router:

```tsx
<UdcReactRouterUrlState collectionPath={(c) => `/udc/${c}`}>…</UdcReactRouterUrlState>;
```

Otherwise pass `links={{ href, navigate }}` to `UdcProvider` (`UdcLinks`).
Without either, links go to `/c/<collection>` and are followed with
`history.pushState` and a `popstate` event (`defaultUdcLinks`).

## API

The package root (`dist/index.d.ts`) has the data view, the providers, the
registry and everything not tied to one renderer. Beyond the above:
`createRendererRegistry`, `rendererEntry`, `rendererTabs`, `resolveTab`,
`UdcRenderersProvider`, `useRendererRegistry` and the `RendererProps` /
`RendererEntry` / `RendererDefinition` / `RendererRegistry` types;
`EmptyState` / `ErrorState` / `NoRendererState`; the `UdcQueryClientOptions` type;
the row activation `useRowActivation`, `rowActivationEnabled`, `ownsKeys`
and the `RowActivationProps` / `RowActivation` / `RowActivationRowProps` /
`UseRowActivationOptions` types; the selection `useRowSelection` with its
pure operations and the `RowSelection` / `RowSelectionState` types; the bulk
actions `UdcActionsProvider`, `useBulkActionHandlers`, `planBulkAction`,
`bulkActionEligible`, `selectionTarget`, `MATCH_ALL` and the
`BulkActionContext` / `BulkActionHandler` / `BulkActionHandlers` /
`BulkActionPlan` types; the row actions `rowActionDefs`, `rowActionsDisplay`,
`eligibleRowActions`, `isRowMenuKey`, `RowActionsControls`, `useRowMenu`,
`rowMenuHandlers`, `rowActionsColumnWidth` and the `RowActions` /
`RowActionsDisplay` / `RowMenuState` / `RowMenuVia` /
`RowActionsControlsProps` / `RowMenuKeyEvent` types; the hooks `useUdcMutateMany`, `useUdcAction` and the
cache helpers `applyToListRows`, `mutateManyTouches`, `callAction`; the cells `createCellRegistry`,
`cellComponent`, `mergeCellRegistries`, `UdcCellsProvider`, `useCellRegistry`
and the `CellProps` / `CellComponent` / `CellDefinition` / `CellRegistry`
types; `mergeMessages`, `makeT`,
`lookup`, `schemaLabelTerms`, `tableSection`, `TRANSLATIONS`, `LOCALES`;
`cn` (tailwind-merge set up for the `udc:` prefix), `storage`, `humanize`;
`UdcUrlStateProvider`, `useUrlSearchParams`, `windowLocationAdapter`,
`prefixUrlStateAdapter`, `createMemoryUrlStateAdapter` and the
`UrlStateAdapter` / `MemoryUrlStateAdapter` types; the embedding types
`UdcDataViewChrome` / `UdcDataViewChromePreset` with `resolveChrome`, and
`UDC_SCOPE_CLASS` (also on `@jsudc/react/ui`); `UdcUiProvider`, `useUiKit` and the `UiKit` type with
its props types; `resolveIcon` with the `lucide:<name>` icons the package
bundles (`LUCIDE_ICONS`); and the zone helpers `allZones`, `offsetLabel`,
`zoneCity`; the lookups: `useUdcLookup`, `useUdcLookups`, `useLookupBatch`,
`UdcLookupBatch`, `LookupValue`, `useLookupLabels`, `useLookupOptions`,
`LookupSelectChip`, `LookupCombobox`, `UdcLinksProvider`, `useUdcLinks`,
`defaultUdcLinks`, `filterHref`, `followLink` (the hooks without markup are in
`@jsudc/react/headless` too); the change feed: `useUdcChanges`,
`useUdcChangeFeed`, `UdcChangeFeed`, `LiveIndicator` and the
`UdcChangeFeedOptions` / `UdcChangeFeedStatus` / `UseUdcChangesOptions` /
`UdcChangesResult` types (see [Live updates](#live-updates)).

The subpaths: one per renderer and `@jsudc/react/all` (see
[Renderers](#renderers)), `@jsudc/react/headless` (see [Headless](#headless)),
`@jsudc/react/ui` (`defaultUiKit` and its primitives: `Button`, `Dialog`,
`Toaster`, `TooltipProvider`, …), `@jsudc/react/react-router`
(`UdcReactRouterUrlState`), `@jsudc/react/styles.css`,
`@jsudc/react/styles.scoped.css` (see [Styling](#styling)) and
`@jsudc/react/tokens.css`.

The build is ESM only, one file per source module (tree-shakeable), one
`dist/<subpath>.js` with its `dist/<subpath>.d.ts` per entry; every dependency
and peer stays an import.

## Develop

```sh
nvm use          # Node 24
npm ci           # also builds dist (prepare)
npm run typecheck
npm run lint     # Biome
npm test         # Vitest + Testing Library in jsdom, no server needed
npm run build    # vite build (lib mode) + tsc (.d.ts) + Tailwind CLI (dist/styles.css)
```

## License

MIT, see [LICENSE](LICENSE).
