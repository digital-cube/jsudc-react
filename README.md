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
  `useUdcMutate`, `useUdcSchema`, `useUdcSource`);
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
npm install github:digital-cube/jsudc-core#v0.3.0 github:digital-cube/jsudc-react#v0.3.1
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

The three activation props are absent unless the host turned activation on;
`useRowActivation` of `@jsudc/react/headless` does everything they describe
(see [Row activation and keyboard](#row-activation-and-keyboard)). How one
column's cells are drawn is not a renderer's business: see
[Custom cells](#custom-cells).

A renderer with `paging: true` draws `data` and needs nothing else; one with
`paging: false` loads its own rows with `filter` (the hooks of
`@jsudc/react/headless`, e.g. `useUdcAllRows`) and reports `onCount`. A message
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
  `useUdcCollection`, `useUdcAllRows`, `useUdcMutate`, `useUdcSchema`, `udcKeys`;
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
  [Row activation and keyboard](#row-activation-and-keyboard)) and the cell
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
not bound (it is the selection's, in 0.5.0). Double-click and Enter still
edit an editable cell when the focus is on the cell itself.

**One tab stop.** The rows are a roving-`tabindex` list: Tab reaches the
active row (else the one last focused, else the first) and leaves the list on
the next Tab. The table is `role="grid"`; the card grid too, each card a
`row`. The active row has `aria-selected="true"`, the attribute
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

- `@jsudc/core` ^0.3.0 — one copy of the protocol, shared with the host's
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
`UseRowActivationOptions` types; the cells `createCellRegistry`,
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
`@jsudc/react/headless` too).

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
