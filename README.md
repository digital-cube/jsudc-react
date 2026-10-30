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
npm install github:digital-cube/jsudc-core#v0.2.0 github:digital-cube/jsudc-react#v0.2.1
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

| Provider                                              | Needed | Why                                                                                                                                                   |
| ----------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UdcProvider client={new UdcClient(...)}`             | yes    | every hook reads the client from it; `renderers={…}` is what the data view draws its tabs with (none given: every tab says no renderer is registered) |
| `QueryClientProvider client={createUdcQueryClient()}` | yes    | the hooks are TanStack Query; `createUdcQueryClient` retries transport failures only, never a protocol error                                          |
| `UdcI18nProvider`                                     | yes    | every string goes through `useI18n()`                                                                                                                 |
| `TooltipProvider`                                     | yes    | Radix tooltips on headers, chips and buttons; with your own kit, `kit.TooltipProvider` (see [Bring your own primitives](#bring-your-own-primitives))  |
| `Toaster`                                             | yes    | save, conflict and schema-edit toasts (`useToast`); with your own kit, `kit.Toaster`                                                                  |
| `UdcUrlStateProvider` / `UdcReactRouterUrlState`      | no     | where search, filters, sort, paging and the tab live; without it `window.location` (see [URL state](#url-state))                                      |
| `TimezoneProvider`                                    | no     | without it instants are shown in the browser's zone; with it the user's pick, kept in `localStorage` (`udc-tz`)                                       |
| `ThemeProvider`                                       | no     | `useTheme()` toggles the `dark` class on `<html>` and keeps the choice (`udc-theme`); any other way of setting that class works too                   |

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
- the registry functions (`createRendererRegistry`, `resolveTab`) and the URL
  state adapter, so its hooks behave exactly as inside `UdcDataView`.

## URL state

The data view keeps what the user chose in the query string, so a link or a
reload opens the same view: the tab (`?tab=`), the search (`?q=`), the chips
and the filter tree, the sort, the paging mode and the page, the kanban board
(`?board=`), the chart window (`?win=`, `?from=&to=`) and the calendar
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

- `@jsudc/core` ^0.2.0 — one copy of the protocol, shared with the host's
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

### Theming

Every colour, radius and font comes from a CSS variable on `:root` and
`.dark`. Restyling is redefining them after the stylesheet, no code:

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

## API

The package root (`dist/index.d.ts`) has the data view, the providers, the
registry and everything not tied to one renderer. Beyond the above:
`createRendererRegistry`, `rendererEntry`, `rendererTabs`, `resolveTab`,
`UdcRenderersProvider`, `useRendererRegistry` and the `RendererProps` /
`RendererEntry` / `RendererDefinition` / `RendererRegistry` types;
`EmptyState` / `ErrorState` / `NoRendererState`; `mergeMessages`, `makeT`,
`lookup`, `schemaLabelTerms`, `tableSection`, `TRANSLATIONS`, `LOCALES`;
`cn` (tailwind-merge set up for the `udc:` prefix), `storage`, `humanize`;
`UdcUrlStateProvider`, `useUrlSearchParams`, `windowLocationAdapter` and the
`UrlStateAdapter` type; `UdcUiProvider`, `useUiKit` and the `UiKit` type with
its props types; `resolveIcon` with the `lucide:<name>` icons the package
bundles (`LUCIDE_ICONS`); and the zone helpers `allZones`, `offsetLabel`,
`zoneCity`.

The subpaths: one per renderer and `@jsudc/react/all` (see
[Renderers](#renderers)), `@jsudc/react/headless` (see [Headless](#headless)),
`@jsudc/react/ui` (`defaultUiKit` and its primitives: `Button`, `Dialog`,
`Toaster`, `TooltipProvider`, …), `@jsudc/react/react-router`
(`UdcReactRouterUrlState`), `@jsudc/react/styles.css` and
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
