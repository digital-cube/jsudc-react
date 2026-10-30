# Changelog

All notable changes to `@jsudc/react` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the package uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). `@jsudc/core`,
`@jsudc/server` and `@jsudc/react` share one version line and release together.

## [Unreleased]

## [0.2.0] - 2026-10-30

Released in lockstep with `@jsudc/core` 0.2.0 and `@jsudc/server` 0.2.0
(which carry no changes). Three breaking changes, each one a step of the
migration below:

1. **react-router adapter**: `react-router` is no longer a required peer; the
   URL state goes through a `UrlStateAdapter`, and a host on react-router
   mounts `UdcReactRouterUrlState`.
2. **UiKit provider**: the renderers take their primitives from a `UiKit` in
   context, and the primitives moved from the root to `@jsudc/react/ui`.
3. **Explicit renderer registry and the `udc:` prefix**: the root registers no
   renderer, each renderer is a subpath with optional peers, and the stylesheet
   is compiled with every Tailwind utility `udc:`-prefixed.

### Migrating from 0.1

In this order; a host that does all five renders as before.

1. **Versions and peers.** Install `@jsudc/core@^0.2.0` and
   `@jsudc/react@^0.2.0` (and `@jsudc/server@^0.2.0` on the server). The
   renderer peers are optional now: keep only those of the renderers you
   register — `@tanstack/react-table` (table), `@dnd-kit/core` (kanban, tree),
   `@dnd-kit/sortable` and `@dnd-kit/utilities` (kanban), `leaflet` (map),
   `recharts` (chart). `react-router` is needed only for step 3.
2. **Register the renderers.** `<UdcProvider client={client}>` becomes
   `<UdcProvider client={client} renderers={RENDERERS}>` with
   `import { RENDERERS } from "@jsudc/react/all"` to keep every tab, or a
   `createRendererRegistry(tableRenderer, …)` of the subpaths you use. Calls to
   `rendererEntry`, `rendererTabs` and `resolveTab` take the registry as their
   first argument; `RENDERERS` is no longer exported from the root.
3. **Mount the router adapter.** A host on react-router wraps its app, inside
   the router, in `<UdcReactRouterUrlState>` from `@jsudc/react/react-router`
   (with a data router: in the root route's element). Without a router there is
   nothing to do; another router gets a `UdcUrlStateProvider` (README, "URL
   state").
4. **Import the primitives from `@jsudc/react/ui`.** `Toaster`,
   `TooltipProvider`, `Button`, `Dialog*`, `useToast`, … are no longer on the
   root; the names and the components are the same.
5. **Import the compiled stylesheet.** Replace `@import
   "@jsudc/react/tokens.css"` plus `@source …/@jsudc/react/dist` in your
   Tailwind entry with `import "@jsudc/react/styles.css"`. CSS of your own
   that targets `scroll-thin`, `select-chevron` or `skeleton` targets
   `udc-scroll-thin`, `udc-select-chevron` and `udc-skeleton`; CSS that reads
   the library's `--color-*` theme variables reads the raw tokens
   (`--border`, …) instead. The stable `udc-*` classes (Added) are the
   supported hooks for overrides.

### Changed (breaking)

- **`react-router` is no longer a required peer.** The URL state of the data
  view (tab, search, chips, filter tree, sort, paging mode and page, the
  kanban `?board=`, the chart window, the calendar `?preset=&date=`) goes
  through a `UrlStateAdapter`. Without a provider the view uses
  `window.location` and the History API, so a page without a router works.
  **A host on react-router mounts `UdcReactRouterUrlState`** from
  `@jsudc/react/react-router` inside its router; otherwise the view writes the
  address bar behind the router's back. `react-router` ^7 stays listed as a
  peer, marked optional in `peerDependenciesMeta`, for that subpath only.
- The calendar's updates read the adapter's current query string instead of
  `window.location.search`, so they also step correctly under a
  `MemoryRouter`. Which keys are written, and replace vs push, are unchanged.
- **The UI primitives moved to `@jsudc/react/ui`.** The package root no longer
  re-exports `Button`, `Checkbox`, `Dialog*`, `DropdownMenu*`, `Input`,
  `inputClass`, `NativeSelect`, `Kbd`, `Skeleton`, `Spinner`, `Popover*`,
  `Segmented`, `Select`, `Toaster`, `useToast`, `Tip` and `TooltipProvider`;
  import them from `@jsudc/react/ui` (same names, same components). A host
  that only mounts `Toaster` and `TooltipProvider` changes that one import.
  The `SegmentedOption`, `SelectOption`, `ToastInput` and `ToastVariant`
  types stay on the root as well.
- The renderers take their primitives from a `UiKit` in context instead of
  importing them. With no kit given nothing changes: the default kit is the
  same Radix + Tailwind components. `DialogContent`'s `title` is typed
  `ReactNode` now; Radix's HTML `title` attribute had narrowed it to `string`.
- **Renderers are registered explicitly.** The package root no longer imports
  any renderer and no longer exports `RENDERERS`. Each renderer is a subpath
  (`@jsudc/react/table`, `/cards`, `/kanban`, `/calendar`, `/tree`, `/map`,
  `/chart`) exporting its definition (`tableRenderer`, …); a host passes a
  registry to `UdcProvider renderers={…}` (or `UdcRenderersProvider`, or
  `UdcDataView renderers={…}`). **The previous default is `RENDERERS` from
  `@jsudc/react/all`:** `<UdcProvider client={client} renderers={RENDERERS}>`
  keeps every tab. Without a registry every tab says no renderer is
  registered. `rendererEntry`, `rendererTabs` and `resolveTab` take the
  registry as their first argument.
- **`@tanstack/react-table`, `@dnd-kit/core`, `@dnd-kit/sortable`,
  `@dnd-kit/utilities`, `leaflet` and `recharts` are optional peers**
  (`peerDependenciesMeta`): each is needed only by the subpath of its
  renderer, so a host that never shows a map does not install Leaflet.
- **Every Tailwind utility is `udc:`-prefixed.** `styles.css` is compiled with
  `@import "tailwindcss" prefix(udc)`, every class in the components is
  written `udc:flex`, `udc:hover:bg-hover`, and the stylesheet carries no
  unprefixed class, so it cannot collide with a host's Tailwind. A host that
  ran Tailwind over the package (`@import "@jsudc/react/tokens.css"` plus
  `@source …/@jsudc/react/dist`) **imports `@jsudc/react/styles.css`
  instead**; its own Tailwind would not generate the prefixed classes. A host
  that passes classes into the components (`className`) uses its own
  utilities as before; `cn()` now merges `udc:` utilities.
- The library's own component classes are namespaced: `scroll-thin`,
  `select-chevron` and `skeleton` are `udc-scroll-thin`,
  `udc-select-chevron` and `udc-skeleton`.
- The plain-CSS rules in `tokens.css` read the raw tokens (`var(--border)`)
  instead of Tailwind's theme variables (`var(--color-border)`), which the
  prefixed build renames to `--udc-*`.

### Added

- `UrlStateAdapter`, `UdcUrlStateProvider`, `useUrlSearchParams()`
  (`[params, setParams]`, react-router's shape), `useUrlStateAdapter()` and
  `windowLocationAdapter`, from the package root.
- The `@jsudc/react/react-router` subpath (`dist/react-router.js`) with
  `UdcReactRouterUrlState`.
- README: a "URL state" section — the default, the react-router adapter,
  writing one for Next.js or TanStack Router.
- The UI kit contract: `UiKit` (one entry per primitive the renderers draw,
  typed by the props they pass) and its props types, `UdcUiProvider kit={…}`
  and `useUiKit()`, from the package root. `UdcProvider` takes an optional
  `kit` and mounts `UdcUiProvider` with it.
- The `@jsudc/react/ui` subpath (`dist/ui.js`): `defaultUiKit` and the
  primitives it is built from.
- README: "Bring your own primitives" — the interface, the provider, and the
  test suite's plain-HTML stub kit as the smallest example.
- Renderer subpaths `@jsudc/react/table`, `/cards`, `/kanban`, `/calendar`,
  `/tree`, `/map`, `/chart`, and `/schema-editor` (the schema editor on its
  own), each one `dist/<subpath>.js` with its `.d.ts`; `@jsudc/react/all`
  with `RENDERERS` and every definition. `createRendererRegistry(...)`,
  `UdcRenderersProvider`, `useRendererRegistry()`, the `RendererDefinition`
  and `RendererRegistry` types and `NoRendererState` from the root.
- `@jsudc/react/headless`: the hooks over the client, `useDataViewState` and
  the URL codecs, `composeFilter`, the folder and live-view helpers, every
  renderer's model, `useKanbanBoard`, `useChartWindow`, `useCalendarUrl`
  (new: the calendar's `?preset=&date=` state), `useTreeExpand`, the
  transforms and cell formatters, the zone helpers. No JSX, no CSS and no
  renderer peer is reachable from it; a test walks its imports.
- Stable classes on every structural element, for plain-CSS overrides:
  `udc-data-view`, `udc-toolbar`, `udc-search`, `udc-filter-chip`,
  `udc-table`, `udc-row`, `udc-cell`, `udc-pager`, `udc-card`, `udc-kanban`,
  `udc-kanban-column`, `udc-kanban-card`, `udc-calendar`,
  `udc-calendar-event`, `udc-tree`, `udc-tree-node`, `udc-map`, `udc-chart`,
  `udc-schema-editor`.
- README: "Renderers" (the subpaths and the peer each needs), "Headless", and
  "Styling" (the prefix, the token table, the stable classes with an override
  example).

### Changed

- The `@jsudc/core` peer range is `^0.2.0`.
- Development installs `@jsudc/core` from npm (`^0.1.1`) instead of
  `github:digital-cube/jsudc-core#v0.1.0`; `package-lock.json` no longer pins
  it over SSH, and CI and the publish workflow drop the deploy-key step.

### Follow-up

- `radix-ui` is still a required peer: the default kit is the fallback when no
  kit is given, so the root entry reaches it through `UdcProvider` and
  `useUiKit()`. Making it an optional peer (a host on its own kit installs no
  Radix) is a later change.
- `styles.css` still carries Tailwind's preflight and the library's `body` /
  `*` base rules, unscoped, in `@layer base`: any unlayered host CSS wins over
  them, but a host page without CSS of its own gets the library's font and
  resets. Scoping them under `.udc-data-view` is a later change.

## [0.1.1] - 2026-10-29

First release on npmjs.org. No change to the code or the API.

### Added

- Published to npmjs.org as a public package; `npm install @jsudc/react`.
- Tags `v*` publish themselves from GitHub Actions with npm provenance
  (`.github/workflows/publish.yml`, OIDC trusted publishing, no token).
- `CHANGELOG.md`; a committed `package-lock.json`, so CI and the publish
  workflow run `npm ci`.

### Changed

- `@jsudc/core` is a **peer dependency**, `^0.1.1` from npm, instead of a
  dependency on `github:digital-cube/jsudc-core#v0.1.0`: install it next to
  this package, so the application has one copy of the protocol.
- `package.json`: `publishConfig.access: "public"`, `repository` / `bugs` in
  object form, keywords `universal-data-collections` and `data-grid`.
- README: install from npm; the GitHub tag stays as an alternative.

## [0.1.0] - 2026-10-29

First tagged version, installed from the GitHub tag.

### Added

- React components for UDC collections: `UdcProvider` and the TanStack Query
  hooks over `@jsudc/core/client`, `UdcDataView` with the table, cards, kanban,
  calendar, tree, map and chart renderers, the schema editor, i18n (English,
  Serbian), theme and time-zone providers, the UI primitives.
- `styles.css`, compiled at build time, and `tokens.css`, its raw source.

[Unreleased]: https://github.com/digital-cube/jsudc-react/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/digital-cube/jsudc-react/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/digital-cube/jsudc-react/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/digital-cube/jsudc-react/releases/tag/v0.1.0
