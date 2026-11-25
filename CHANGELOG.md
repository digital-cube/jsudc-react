# Changelog

All notable changes to `@jsudc/react` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the package uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). `@jsudc/core`,
`@jsudc/server` and `@jsudc/react` share one version line and release together.

## [Unreleased]

### Fixed

- A long `lookup_array` chip ends in "…" inside its rounded box instead of
  being cut off at the cell's edge. Its text is a span of its own that
  truncates (the bare text of an `inline-flex` box is an anonymous flex item
  that `text-overflow` never reaches), and the chip is no longer `shrink-0`:
  it is at most `--udc-chip-max-width` wide (default `12em`) and may shrink
  down to `--udc-chip-min-width` (default `2.5rem`, e.g. "K…"). When the chips
  do not fit, the first ones keep their width and the last visible one
  shrinks first (each chip's `flex-shrink` is a million times the one before
  it). A 150 px column with "Klijent Petrović — ugovor 2026" now shows
  "Klijent Petrović — …" in a 132 px chip (before: a 172 px chip cut hard).

### Added

- `row_actions_display: hover`, a third way to draw a view's row actions (the
  mail-list pattern): no action column at rest, and a compact bar of round icon
  buttons over the row's trailing cells while the row is hovered, holds the
  focus, has its menu open or runs an action. The column layout is exactly the
  one of the same view without row actions (`rowActionsColumnWidth` answers 0);
  the bar is stuck to the pane's right edge, above right-pinned columns, on the
  row's own background (hovered, selected or its `row_color` tone) with a fade
  at its left edge. Each button is `size-8`, round, with a hover / focus
  highlight, a tooltip and an `aria-label`; destructive ones keep the danger
  colours. Eligible actions with an icon and not `placement: menu` are buttons,
  up to `row_actions_max` (default 4); the rest go to a round ⋮ dropdown at the
  bar's end (no ⋮ when nothing is left over). Right-click on the row and the
  menu key open every eligible action. A hidden bar takes no pointer but stays
  in the Tab order. On a device that cannot hover (`@media (hover: none)`) it
  draws exactly as `menu`; the cards draw the menu as before. **Needs
  `@jsudc/core` 0.8.1 on the server and in the client**: an older core refuses
  a view that says `hover` (no fallback). A view with `inline`, `menu` or no
  display draws what it drew in 0.8.0.
- Headless: `splitRowActions(eligible, { hasIcon, max })` (`{ bar, overflow }`),
  `rowActionsMax(view)`, `rowActionPlacement(def)`, `DEFAULT_ROW_ACTIONS_MAX`,
  `useCanHover()` and `effectiveRowActionsDisplay(display, canHover)`;
  `RowActions.split(row)` next to `eligible(row)`. `rowActionsDisplay` answers
  `hover` and reads the view loosely, so it types against `@jsudc/core` 0.8.0.
  `RowActionsControls`' `display` takes `"hover"`; `rowActionsColumnWidth`
  takes the drawn display as an optional second argument.

- A lookup chip or label can be plain text instead of a link: when
  `UdcLinks.href` returns `null` for the target collection (the host has no
  view of it), the chip is a `<span>` with no hover underline, and a click on
  it falls through to the row (`onRowActivate`, a `row_link`). The same `null`
  makes a `row_link` to that collection do nothing. `collectionPath` of
  `UdcReactRouterUrlState` may return `null` to the same effect. A link chip
  carries `data-link`.
- The chip's weight and size are host variables: `--udc-chip-font-weight`
  (default `500`) and `--udc-chip-font-size` (default `11px`), next to
  `--udc-chip-max-width` and `--udc-chip-min-width`.

### Changed

- `UdcLinks.href` and `filterHref` are typed `string | null`. A host's
  `UdcLinks` that returns a string needs no change; code that calls
  `filterHref` itself and needs a string has to handle `null`.

## [0.8.0] - 2026-11-23

Coloured lookup chips; released together with `@jsudc/core` 0.8.0 (which
defines `lookup.color_field`) and `@jsudc/server` 0.8.0. The `@jsudc/core`
peer range is `^0.8.0`. Nothing changes for a view or a collection that worked
on 0.7.0.

### Added

- A `lookup_array` chip takes the colour of its target row when the lookup
  names a `color_field` (`@jsudc/core`: `LookupDef.color_field`): the row's
  value is the chip's `data-color`. A palette tone (`accent`, `success`,
  `warning`, `danger`, `info`, `muted`, `default`) draws as that tone's badge;
  any other name (e.g. `red`) is the host's to map with
  `.udc-lookup-chip[data-color="red"] { --udc-chip-bg: …; --udc-chip-fg: … }`,
  per theme. Without a value, or without `color_field`, the chip is unchanged.
  `lookupColor(row, lookup)` gives the value.

## [0.7.0] - 2026-11-23

The client side of the first SQLite set; released together with `@jsudc/core`
0.7.0 and `@jsudc/server` 0.7.0. Needs `@jsudc/core` 0.7.0. Nothing changes
for a view or a collection that worked on 0.6.0.

### Added

- The error code `busy` (`@jsudc/core` 0.7.0: another writer held the data's
  lock longer than the server waits, e.g. another process writing the same
  SQLite file; nothing was written) is a warning toast that says to try again
  — "The data is busy" / "Someone else is writing to it right now. Nothing was
  saved; try again in a moment." (`BUSY_TITLE`, `BUSY_BODY`, English and
  Serbian) — instead of a red failure carrying the server's text. Every write
  path shows it: a table cell edit, a kanban drop or card edit, a calendar
  move, a tree move, a row action and a bulk action. Optimistic changes roll
  back as for any failed write.
- A query that fails with `busy` is retried twice, as a transport failure is
  (`shouldRetry`); every other protocol error still is not.

### Changed

- The `@jsudc/core` peer range is `^0.7.0` (`busy`, `sqlite_table`); `^0.6.0`
  does not accept 0.7.0. Against 0.6.0 a `describe` of a `sqlite_table`
  collection does not parse, and a `busy` reply reads as a malformed error
  (`internal`).

A `sqlite_table` collection needs nothing else here: its `describe` is drawn
like any other table's, and `sourceGroup` (core) puts it in the sidebar's
`database` group, so a host's group icon applies as for `postgres_table`.

## [0.6.0] - 2026-11-23

What a mail client's list views asked for after 0.5.1: an embedded view without
a toolbar, a view's default order, hidden columns, headers that sort only what
the source sorts, column widths that follow the pane and an empty state per
collection; released together with `@jsudc/core` 0.6.0 and `@jsudc/server`
0.6.0. A view that uses none of the new keys renders exactly as before.

### Added

- One collection's empty state can be reworded: `EMPTY_TITLE`, `EMPTY_PLAIN`
  and `EMPTY_BODY` are looked up in `TBL_<COLLECTION>` before `APP`, as
  `SEARCH_PLACEHOLDER` already is, in every renderer (table, cards, kanban,
  tree, calendar, map, chart). `messages.TBL_MAIL_MESSAGES.EMPTY_PLAIN` makes
  an empty mail folder say "No messages here." while the app's other views
  keep "This collection has no rows yet.". `EmptyState` takes an optional
  `collection` for the same lookup in a host's own renderer. Without such
  terms nothing changes. See README "i18n".
- Table columns sized to the table's pane: a column `width: fill` takes the
  free width left by the fixed columns (never under its `min_width`, default
  `default_column_width`; several share it by `grow`), and `hide_below: N`
  leaves a column out while the table's pane is narrower than N px. The pane
  is measured with a `ResizeObserver`, only when a column uses either key; a
  view without them renders exactly as before. Works with `@jsudc/core`
  ^0.5.0 (the keys are read loosely). `layoutColumnWidths`, `hiddenAtWidth`,
  `isFillWidth` and `usePaneWidth` are exported from `@jsudc/react/table`. See
  README "Table column widths".
- Sortable headers: a table header is a sort button only for a field the source
  sorts on, as `describe.sortable` (`@jsudc/server` 0.6.0) says; any other is a
  plain header, like a `json` field's. A column marked `sortable: false` is
  plain too. A sort on a field the source does not sort (from the URL, an old
  link or a `default_sort`) is dropped before the list goes out, so one header
  click can no longer turn the list into "Could not load the data". Without
  `describe.sortable` (an older server) every header sorts, as before.
  `sourceSortable` and `columnSortable` are exported; `liveSort` takes the
  sortable set as an optional third argument. Works with `@jsudc/core` ^0.5.0
  (both keys are read loosely). See README "Sortable headers".
- A default sort: `UdcDataView` sends the view's `default_sort` (`@jsudc/core`
  0.6.0), or the new `defaultSort` prop instead of it (`[]`: none), as the
  list's `sort` while the URL state has no `sort`. The first page is already in
  that order; the default is shown in the headers (`RendererProps.sort`) and
  not written into the URL. "No sort" picked from a header is written as an
  empty `sort=`; picking the default again removes the parameter. While a
  search answered by the source is typed without a sort of the user's, the
  default steps aside so the rows come best match first. A view without either
  behaves exactly as before. Works with `@jsudc/core` ^0.5.0 (the key is read
  loosely). See README "Default sort".
- A column marked `hidden: true` is not drawn by any renderer: `liveView`
  drops it, so the table, the cards' default title, the map's default popup
  fields and the detail dialogs skip it even when an older server still
  serves it. The field stays in every row (`CellProps.row`), the filter builder
  and search; a `card_options.meta_fields` entry naming it still shows it.
  `columns_mode: listed` is the server's (`@jsudc/server` `describe`).
- `UdcDataView chrome` gains toolbar flags: `toolbar`, and per control
  `search`, `chips`, `filterBuilder`, `freshness` and `count`.
  `chrome={{ preset: "embedded", toolbar: false }}` embeds the rows alone, for
  a host whose screen has a toolbar of its own: no toolbar element is
  rendered (with it go the renderer's toolbar controls, the live indicator,
  the chart window control and `toolbarStart` / `toolbarEnd`). The filter
  pills and the bulk bar still show when in use. The flags are on in either
  preset, so every view without them renders as before; `resolveChrome`
  returns the six new keys, each control `false` when `toolbar` is.

### Changed

- The `@jsudc/core` peer range is `^0.6.0` (`default_sort`, `hidden` and
  `columns_mode`, `describe.sortable`, `width: fill` with `grow`, `min_width`
  and `hide_below`); `^0.5.0` does not accept 0.6.0. The new keys are still
  read loosely.

## [0.5.1] - 2026-11-22

Patch release of `@jsudc/react` alone; `@jsudc/core` and `@jsudc/server` stay
0.5.0 and the peer range `^0.5.0` is unchanged.

### Added

- `UdcChangeFeed.reconnect()` (also `useUdcChangeFeed()?.reconnect()`):
  closes the change feed's stream at once and opens it again for the same
  collections, so the server scopes it to whoever the client's `headers`
  say is signed in now. The collections report `reconnecting` until it is
  open; data fetched before the call is then refetched. It also asks again
  for a stream the server refused, which otherwise waits for the set of
  collections to change.
- `UdcProvider changes={{ identity }}` (`UdcProviderChangesOptions`): when
  `identity` changes the provider reconnects its feed, without remounting
  anything below it. For a `headers` function whose user changes (a demo
  user switcher, an account switcher, impersonation); before, the stream
  kept the previous user's scope until the collections on screen changed.
- `UdcChangeFeedContext` is exported (from `@jsudc/react` and
  `@jsudc/react/headless`), so a host can provide a `UdcChangeFeed` of its
  own.

### Fixed

- **A source that does not count (`capabilities.total_count: false`) no
  longer leaves the toolbar's row count a loading skeleton forever.** Such a
  source (`postgres_table`'s `totalCount: false` in `@jsudc/server` 0.4.0)
  answers every `list` with `total: null`, which the data view read as "still
  loading". The skeleton now stands only until the first page has answered;
  then the count shows what is known: "Showing 50+" while infinite mode has
  more to load, "Showing 12" once it has all of it, "Showing 51–100" in pages
  mode, and nothing when the list failed. `[data-testid="row-count"]` carries
  `data-loading="true"` while the skeleton is up and still no `data-total`
  without a total. A renderer that counts itself (the kanban) and reports no
  total shows "Showing N" when the source does not count.
- **Pages mode without a total.** The pager used to disappear (it drew only
  for `total > 0`), so there was no way past the first page. It now draws for
  a source that does not count too: the range of the page ("51–100", no "of"),
  the pages seen so far and the next one while the page is full, previous and
  next, "Page N" instead of "Page N of M", and no last page.
- **Infinite mode by offset without a total.** A source that pages by
  `offset` only and does not count stopped after its first page; a full page
  now asks for the next one, as `fetchAllRows` already did.

## [0.5.0] - 2026-11-22

Row selection and the bulk bar, row actions, host actions from the browser
(`useUdcAction`, `useUdcMutateMany`), search answered by the source, live
updates from the change feed and windowed rows for long lists, released
together with `@jsudc/core` 0.5.0 and `@jsudc/server` 0.5.0. Needs
`@jsudc/core` 0.5.0. A host that changes nothing keeps 0.4.0's behaviour.

Selection and bulk actions, row actions (R1 + S3, the React part), host
actions in the browser (S4), search answered by the source (S6), live
updates over the change feed (S5) and long lists in the table (R5). Builds on `@jsudc/core` 0.5.0's
`mutate_many`, typed host actions, eligibility helpers, the `set` / `action` /
`confirm` keys of `ActionDef`, `ListRequest.search` with the capability
`search`, and `UdcClient.changes` with the capability `changes`.

### Added

- Row selection in the data view: on when the view says `multiselect: true`
  or declares `bulk_actions`, forced on or off by the new `selectable` prop of
  `UdcDataView`. The table draws a checkbox column pinned at the start, a
  header checkbox for the loaded rows (with the indeterminate state) and
  selects a range on shift-click; the cards a checkbox per card; with row
  activation on, Space toggles the active row (Shift+Space a range). The
  selection is cleared by a new filter (search, chips, filter tree, the
  host's `filter`) or collection, kept across a sort, a refetch and more
  pages. Kanban, tree, calendar, map and chart do not select.
- "Select all that match": with the loaded rows all selected and more
  matching, the bar offers "Select all N that match" (no number when the
  list's `total` is `null`), switching to "every row the filter matches,
  except these" — the action then goes by filter and the message reports the
  server's `updated`.
- The bulk bar: the count (or "all matching"), a button per
  `view.bulk_actions` entry (label from `ACTION_<KIND>` of the collection's
  section, `ACTIONS.<kind>`, else the def's `label`; `icon`; `variant`),
  disabled unless `when` holds for every selected row (offered unless
  `when: false` in "all that match" mode), and a clear button.
- Handlers by `kind`: `UdcDataView actions` and `UdcProvider actions` (also
  `UdcActionsProvider`, `useBulkActionHandlers`) take
  `{ archive: ({ ids, filter, exceptIds, rows, collection, clearSelection, def, kind }) => … }`
  (`BulkActionHandlers`, `BulkActionContext`). Without a handler: `delete`
  asks, then `mutate_many` `delete`; a def with `set` sends `mutate_many`
  `update`; any other kind calls the server action its `action` names
  (default `kind`) with `{ collection, ids | filter, except_ids }`. An
  `unsupported_op` answer is shown naming the action; `failed` ids are
  reported by count and stay selected (`planBulkAction`,
  `bulkActionEligible`, `selectionTarget`, `MATCH_ALL`).
- `RendererProps.selection` (optional `RowSelection`): set while the view
  selects and the renderer reads the paged list. A renderer written against
  0.4.0's `RendererProps` still compiles.
- `@jsudc/react/headless` (and the root): `useRowSelection` and its pure
  operations `toggleSelection`, `selectRange`, `setPageSelection`,
  `selectAllMatching`, `pageSelectionState`, `selectionCount`,
  `selectionHas`, `selectionIsEmpty`, `EMPTY_SELECTION` (types
  `RowSelection`, `RowSelectionState`, `UseRowSelectionOptions`).
- `useUdcMutateMany(collection)`: `mutate_many` with the optimistic update
  `useUdcMutate` does for one row — loaded rows patched or removed (the total
  counted down) in every cached list at once, rolled back on an error, lists
  and lookups invalidated when settled; resolves to `{ updated, failed }`.
  Helpers `applyToListRows`, `mutateManyTouches`; type `UdcMutateManyVars`.
- `useUdcAction(definitionOrName, options?)` (S4): a mutation over the
  client's typed `call` for a host action — typed from a `defineHostAction`
  definition (the answer checked against its schema) or by the caller for a
  name; `invalidates` refetches collections' lists afterwards
  (`UseUdcActionOptions`, `callAction`).
- `useRowActivation` takes `isSelected` and `onToggleSelect(row, range)`;
  `RowActivationRowProps` gains the optional `aria-current`.
- i18n terms in `en` and `sr`: `SELECT_ROW`, `SELECT_PAGE`,
  `SELECTED_COUNT`, `SELECTED_ALL_COUNT`, `SELECTED_ALL_MATCHING`,
  `SELECT_ALL_MATCHING_COUNT`, `SELECT_ALL_MATCHING`, `SELECTION_CLEAR`,
  `BULK_ACTIONS`, `BULK_DELETE`, `BULK_NOT_ELIGIBLE`, `BULK_CONFIRM`,
  `BULK_CONFIRM_DELETE_COUNT`, `BULK_CONFIRM_DELETE_MATCHING`,
  `BULK_CONFIRM_DELETE_BODY`, `BULK_CONFIRM_ACTION_COUNT`,
  `BULK_CONFIRM_ACTION_MATCHING`, `BULK_DONE_COUNT`, `BULK_DONE`,
  `BULK_DELETED_COUNT`, `BULK_FAILED_COUNT`, `BULK_FAILED`,
  `BULK_UNSUPPORTED`.
- README section "Selection and bulk actions" (a worked mailbox example,
  the behaviour without a total, the accessibility of selection next to the
  active row, `useUdcMutateMany` and `useUdcAction` with a worked example).
- Row actions: each row offers its view's `row_action_defs` (else the kinds
  of `row_actions`, as udc-js reads them), each only where its `when` holds
  for that row. `row_actions_display: inline` (the default) draws icon
  buttons in a trailing table column pinned at the end; `menu` one "more"
  button per row and the same dropdown on right-click of the row. The cards
  draw them as a menu on each card. With row activation on, the focused row
  opens its menu from the context-menu key, Shift+F10 or `.`, and the focus
  returns to the row when it closes. A click on an action neither activates
  the row, nor follows its `row_link`, nor toggles its selection. A view with
  no row actions draws what it drew before.
- Running a row action is the bulk path on one row: the host's
  `actions[kind]` handler (its context gains the optional `row`, with
  `ids: [id]`, `rows: [row]`); else `delete` after a confirmation
  (`mutate_many` when the source has it, else `mutate`), a `set` patch
  (optimistic, rolled back on an error), or the server action the def names
  with `{ collection, ids: [id] }`. `BulkActionContext.row` is optional and
  absent for the bulk bar.
- `RendererProps.rowActions` (optional `RowActions`: `display`, `defs`,
  `eligible(row)`, `label(def)`, `run(def, row)`, `runningOn(id)`), set when
  the view declares row actions. `RowActionsControls`, `useRowMenu`,
  `rowMenuHandlers`, `rowActionsColumnWidth` draw the built-in ones in a
  host renderer; `rowActionDefs`, `rowActionsDisplay`, `eligibleRowActions`
  and `isRowMenuKey` are also in `@jsudc/react/headless`.
- The `UiKit` contract: `DropdownMenu` takes the optional `open` and
  `onOpenChange`, `DropdownMenuContent` the optional `onCloseAutoFocus` (the
  default kit passes them to Radix). A kit that ignores them still opens a
  row's menu from its trigger.
- i18n terms in `en` and `sr`: `ROW_ACTIONS`, `ROW_ACTIONS_MORE`,
  `ROW_CONFIRM_DELETE`, `ROW_CONFIRM_ACTION`.
- README section "Row actions" (a worked mailbox example: "mark read"
  through `set`, "archive" through a host handler, both hidden where `when`
  fails).
- Search answered by the source (S6): when `describe.capabilities.search`
  is `"source"`, the search box's text is sent as `ListRequest.search` and
  not composed into the filter — in the paged list, in the renderers that
  load their own rows (kanban, calendar, map, chart, a tree that does not
  highlight in the browser) and in the query keys. A collection without the
  capability sends exactly today's requests. With a search and no sort the
  table shows no sort indicator (relevance order); a chosen sort is sent with
  the search.
- `search?` on `useUdcCollection`, `useUdcAllRows` and `fetchAllRows`
  (blank: not sent, not in the key); `ListKeyParams.search?`;
  `RendererProps.listSearch?`, the text a renderer that loads its own rows
  passes on.
- The selection is cleared by a new source search text; "select all that
  match" is not offered while a source search is active (`mutate_many` by
  filter cannot carry the text), with a hint instead. i18n term
  `SELECT_ALL_MATCHING_SEARCH` in `en` and `sr`.
- README section "Search answered by the source".
- Live updates (S5): `UdcProvider changes` (`true` or `UdcChangeFeedOptions`
  `{ debounceMs, batchMs, removeDeleted, minDelayMs, maxDelayMs,
  idleTimeoutMs }`; off by default, no connection) opens one change-feed
  stream (`UdcClient.changes`) for the collections the views and hooks below
  show, each one that offers `capabilities.changes`. Collections are
  reference-counted: added when the first view of one mounts, dropped when
  the last one unmounts; the stream is reopened with the new list, the old
  one closed only once the new one is subscribed. A provider without
  `changes` under another one with the same client uses the outer feed.
- On an event the collection's lists, the lookup batches into it and its
  lookup picker options are invalidated, a burst debounced into one
  invalidation (and held back while a mutation is in flight); a `delete`
  with `ids` takes those rows out of the cached lists at once. "Reconnected"
  invalidates every collection of the stream; a collection that joins it is
  refetched when its data predates the subscription.
- Polling is the fallback: `refresh_interval_ms` (`refetchInterval` of
  `useUdcCollection` / `useUdcAllRows`) is suspended while the stream carries
  the collection and resumes while it reconnects, when it is refused, or
  without a feed. An unauthenticated stream goes to `createUdcQueryClient`'s
  `onUnauthenticated`, in the same burst as the queries, and is not reopened
  until the set of collections changes.
- `useUdcChanges(collection, onEvent?, options?)` → `{ status, live }`
  (`UdcChangeFeedStatus`: `off`, `connecting`, `live`, `reconnecting`,
  `down`; `UseUdcChangesOptions` `{ capabilities, enabled }`,
  `UdcChangesResult`): subscribes for a host (a badge counter) and is what
  the data view, `useUdcCollection`, `useUdcAllRows`, `useUdcLookup`,
  `useUdcLookups` and `useLookupOptions` subscribe through.
  `useUdcChangeFeed()` and the class `UdcChangeFeed` are exported too (also
  from `@jsudc/react/headless`).
- `UdcDataView liveIndicator` (default `true`): "live" / "reconnecting"
  beside the freshness pill while a feed carries the collection
  (`LiveIndicator`); nothing without a feed. i18n terms `FEED_LIVE`,
  `FEED_LIVE_HINT`, `FEED_RECONNECTING`, `FEED_RECONNECTING_HINT` in `en` and
  `sr`.
- `capabilities` of `useUdcCollection` and `useUdcAllRows` accept
  `changes` next to `paging` (a wider `Pick`; what compiled still compiles).
- README section "Live updates".
- Long lists: in infinite mode the table mounts only the rows in and near
  its viewport (an overscan of 10 rows on each side), spacer rows standing
  for the rest so the scrollbar and the scroll position are those of every
  loaded row. Automatic once more than 200 rows are loaded; a list at or
  under that draws the markup it drew before. Pages mode is never windowed.
  No new dependency: rows have one height, so the window is arithmetic.
- `UdcDataView virtualize` and `TableRenderer virtualize`
  (`TableVirtualizeProp`: `boolean` or `TableVirtualization`
  `{ enabled?: boolean | "auto", threshold?, overscan? }`) force it on or
  off and set the threshold and the overscan; `RendererProps.virtualize`
  carries it to a renderer when the host set it.
- Across the window: the keys of row activation scroll a row outside it in,
  mount it and focus it (Home / End to the first / last loaded row); the
  active row, the tab stop, the focused row, a row with an open cell editor
  and a row whose menu is open stay mounted wherever they are; selection
  ranges and "the page" are computed over the loaded rows; the sentinel,
  pinned columns, row actions, custom cells and lookup batching (one fetch
  for every loaded row) are unchanged; a refetch keeps the scroll position.
  A windowed table's `aria-rowcount` is the loaded count and each row has
  its `aria-rowindex`.
- `useRowActivation` takes an optional `reveal(row, index)`: a windowed list
  is asked to mount a row the keys moved to, which then takes the focus as
  it attaches.
- `@jsudc/react/headless` (and, the options, the root): `useRowWindow`,
  `virtualizationApplies`, `resolveVirtualization`, `visibleRange`,
  `withOverscan`, `keepRange`, `bodySlices`, `DEFAULT_VIRTUAL_THRESHOLD`,
  `DEFAULT_VIRTUAL_OVERSCAN`, the types `TableVirtualization`,
  `TableVirtualizeProp`, `RowRange`, `BodySlice`, `UseRowWindowOptions`,
  `RowWindow`.
- README section "Long lists" (its limits: find-in-page sees only the
  mounted rows, printing prints the window).

### Changed

- The `@jsudc/core` peer range is `^0.5.0` (`mutate_many`, host actions, action eligibility, `ListRequest.search` and
  `UdcClient.changes` come from core 0.5.0). The development
  dependency is pinned to core's `release-0.5.0` commit until core 0.5.0 is on
  npm.
- With selection on and row activation on, `aria-selected` on a row is its
  selection (the grid is `aria-multiselectable`) and the active row is marked
  `aria-current="true"`. With selection off nothing changes: `aria-selected`
  marks the active row as in 0.4.0.

## [0.4.0] - 2026-11-22

Sessions (a signed-out state, `onUnauthenticated`), embedding a view in a
host's screen with a scoped stylesheet, row activation and keyboard movement,
and a cell registry, released together with `@jsudc/core` 0.4.0 and
`@jsudc/server` 0.4.0. Needs `@jsudc/core` 0.4.0.

### Added

- Sessions: `createUdcQueryClient(options?)` takes `UdcQueryClientOptions` —
  `onUnauthenticated(error)`, called when a query or a mutation fails with
  `isUnauthenticated` (an HTTP 401, or the server's in-protocol "not signed
  in"), once per burst; `unauthenticatedQuietMs` (default 2000) ends a burst.
  Without arguments it is what it was.
- `ErrorState` shows "You are signed out" (`APP.SIGNED_OUT_TITLE`,
  `APP.SIGNED_OUT_BODY`, `en` and `sr`, overridable) without Retry for an
  unauthenticated error, in every view.
- README section "Sessions": a cookie session, a CSRF header read per call,
  `onUnauthenticated` sending the user to the host's login.
- Embedding a view (`UdcDataView`, every prop optional; without them the view
  is unchanged):
  - `filter`: a `FilterNode` of the host's, ANDed into every list the view and
    its renderers load (`filter`, `baseFilter`, `unwindowedFilter` of
    `RendererProps`) and counted in "of M"; not a chip or pill, not in the
    URL, not removed by "clear filters", not "the user filtered".
  - `chrome`: `"full"` (default), `"embedded"`, or `UdcDataViewChrome` flags
    `header`, `tabs`, `pagingToggle`, `docTab`, `sourceTab`, `frame` over a
    `preset`; `resolveChrome` resolves them. Without the paging toggle the mode
    is `pagingMode`, else the view's `pagination`, not a stored choice.
  - `pagingMode`: the mode to open in instead of the view's `pagination`.
  - `toolbarStart`, `toolbarEnd`: host content in the toolbar.
  - `urlPrefix` and `urlState` (`"url"`, `"memory"` or a `UrlStateAdapter`):
    the view's parameters, its renderers' (`board`, `win`, `from`, `to`,
    `preset`, `date`) included, under a prefix or in memory.
- `prefixUrlStateAdapter(inner, prefix)` (reads and writes only its own keys
  of any `UrlStateAdapter`) and `createMemoryUrlStateAdapter(initial?)` (a
  query string in memory, `MemoryUrlStateAdapter`), from the root and
  `@jsudc/react/headless`.
- `useDataViewState` options `mode` (instead of the view's `pagination`) and
  `fixedMode` (ignore `?mode=` and the stored choice).
- `@jsudc/react/styles.scoped.css`: the same utilities, tokens and resets as
  `styles.css`, applied only inside `.udc-data-view` and `.udc-scope`; no rule
  on `*`, `html`, `body` or `:root`, no global preflight, no `@property`.
  Built by `build:css` (`scripts/scope-css.mjs`) and guarded by
  `scripts/check-scoped-css.mjs`. `styles.css` is unchanged.
- The default UI kit's portalled content (dialogs and their overlay, popovers,
  dropdown menus, selects, tooltips, the toast viewport) carries the class
  `udc-scope`; `UDC_SCOPE_CLASS` from the root and `@jsudc/react/ui`.
- `RendererProps` is a documented public contract (README "Renderers", with a
  host-written renderer); `smoke/types.ts` compiles one against the published
  declarations, so `npm run check:types` fails when the contract changes.
- README sections "Embedding a view" (with a three-pane screen), "Writing a
  renderer: the `RendererProps` contract" and "The scoped sheet".
- `lightningcss` is a devDependency (it was already installed through
  Tailwind and Vite); the build uses it to scope the sheet.
- Row activation and keyboard movement (`UdcDataView`, every prop optional;
  without them the rows are unchanged):
  - `onRowActivate(row)`: Enter on a row, or a plain click of it.
  - `activeRowId`: the row drawn as active (`aria-selected="true"`,
    `data-active="true"`, the `--selected` background); controlled when
    passed, kept by the view (across tab switches) when not.
  - `onActiveRowChange(row | null)`: the active row moved by the keys (no
    Enter needed) or by a click on another row, so a host can preview on move.
  - In the table and the cards: ArrowDown / `j`, ArrowUp / `k`, Home, End
    move, Enter activates; not while an input, the search box, a cell editor,
    a menu, a list box or a dialog has the focus, nor with a modifier; Space
    is not bound. One tab stop for the rows (roving `tabindex`), the table and
    the card grid `role="grid"`, each row or card a `row`.
  - The active row and the focus are kept by row id across a refetch, a sort
    and infinite pages; ArrowDown on the last loaded row in infinite mode
    loads the next page and moves onto it; the active row is scrolled into
    view; a row that left the list stops being active.
  - `row_link`: unchanged without `onRowActivate`; with it a plain click
    activates and Cmd / Ctrl-click and the middle button follow the link.
- `RendererProps` gains the optional `onRowActivate`, `activeRowId` and
  `onActiveRowChange` (absent unless activation is on); a renderer written
  against 0.3.1's props still compiles (`smoke/types.ts`).
- `useRowActivation(options)` (with `rowActivationEnabled`, `ownsKeys` and the
  `RowActivationProps`, `RowActivation`, `RowActivationRowProps`,
  `UseRowActivationOptions` types), from `@jsudc/react/headless` and the
  root: the table's activation and keys for a host renderer (`rowProps(row)`,
  `handleClick`, `move`, `activate`).
- Custom cells: `createCellRegistry(...{ name, component })` (a `CellRegistry`;
  a plain object works too), `UdcProvider cells`, `UdcCellsProvider` (nested
  ones add up), `useCellRegistry`, `cellComponent`, `mergeCellRegistries`, and
  `UdcDataView cells` (added to the provider's, its names winning). A column's
  `render` resolves from the host's registry first, then the built-in kinds; a
  registered built-in name (`badge`, …) replaces that kind; an unregistered
  name behaves as before. The cards' meta fields use the same registry; the
  other renderers keep the built-in kinds. Root and `@jsudc/react/headless`.
- `CellProps`, the documented contract of a cell component: `value`, `row`,
  `column` (with `render_options`), `def`, `collection`, `locale`,
  `intlLocale`, `editable`, `surface` (`"table"` or `"card"`).
- `CellValue` takes the optional `cells`, `row`, `collection` and `surface`.
- The cell editor's root carries `data-cell-editor`.
- README sections "Row activation and keyboard" (a list and a reading pane,
  the pane following the keyboard; a host renderer on `useRowActivation`) and
  "Custom cells", linked from the `RendererProps` contract.

### Changed

- With `@jsudc/core` 0.4.0 an HTTP 401 / 403 in front of `/udc` is a `UdcError`
  (`forbidden`), so it is no longer retried twice and shown as a transport
  failure with Retry: it shows at once, a 401 as signed out, a 403 as the
  generic failure. `shouldRetry` itself is unchanged.
- The `@jsudc/core` peer range is `^0.4.0` (sessions import
  `isUnauthenticated`, which only core 0.4.0 exports). The development
  dependency is pinned to core's `release-0.4.0` commit until core 0.4.0 is on
  npm.

## [0.3.1] - 2026-11-15

Patch release of `@jsudc/react` alone; `@jsudc/core` and `@jsudc/server` stay
0.3.0 and the peer range `^0.3.0` is unchanged.

### Fixed

- A `row_link` drill-down onto a collection whose default renderer is kanban
  no longer lands on an empty board. Without `?board=`, the kanban's and the
  calendar's board select follow an `eq` on `kanban_options.ticket_board_field`
  in `?f=` (at the root or under `and`s); an unknown `?board=` falls back to it,
  and only then to the first board. `boardFromFilter(tree, boardField)` is
  exported from the headless entry with the rest of the kanban model.
- The option list of `LookupCombobox` (the inline editor of a `lookup` /
  `lookup_array` cell) had no background: it used `udc:bg-popover` /
  `udc:text-popover-foreground`, which the theme does not define, so the
  sheet had no rule for them. It now uses `udc:bg-surface-raised` /
  `udc:text-foreground`, like the other popovers.

### Added

- `scripts/check-classes.mjs`, run by `build:css`: the build fails when a
  `udc:` class used in `src` produces no rule in `dist/styles.css`, so a
  missing theme token or a misspelt utility cannot ship again.

## [0.3.0] - 2026-11-15

Lookups, level 1, and drill-down (`row_link`) in the components, released
together with `@jsudc/core` 0.3.0 and `@jsudc/server` 0.3.0. Needs
`@jsudc/core` 0.3.0, and a server that speaks lookups (`@jsudc/server` 0.3.0).

### Added

- Lookups, level 1: a `lookup` / `lookup_array` cell shows the target's
  `label_field` as a link to the target filtered by the key (the bare key
  until it resolves), a `lookup_array` as chips. Cards, kanban and calendar
  details draw the same cell; kanban avatars read the labels.
- `useUdcLookup(target, keys)` and `useUdcLookups`: one batch `list` with an
  `in` filter, cached under `["udc", "lookup", collection, sortedKeys]`.
  `useLookupBatch` / `UdcLookupBatch`: one call per lookup field for the rows
  of a table or a board.
- The `select` chip over a lookup field lists the target's rows by label
  (`LookupSelectChip`), with a server-side search above 50 rows.
- Inline edit of a lookup: `LookupCombobox`, a search over the target.
- `row_link`: a row click opens the linked collection filtered by the row's
  value; Cmd / Ctrl / middle click opens a new tab.
- `UdcLinks` (`UdcProvider links`, `UdcLinksProvider`, `useUdcLinks`,
  `defaultUdcLinks`, `filterHref`, `followLink`) and
  `UdcReactRouterUrlState collectionPath`: where those links go.
- `udcKeys.lookup`, `udcKeys.lookups`, `udcKeys.lookupOptions`.
- A filter pill on a lookup field shows the target's labels.

### Changed

- The `@jsudc/core` peer range (and the development dependency) is `^0.3.0`.
- `useUdcMutate` also invalidates the lookups of the collection it wrote.
- The kanban finds its board collection from a `lookup` board field too
  (`boardSource`), not only from a `relation`'s `ref`.
- A filter tree keeps a condition on `id` (the row id) instead of pruning it
  as an unknown field.
- `CellEditor`'s `onCommit` and `fromEditorValue` take `EditorRaw`
  (`string | boolean | { picked }`).

## [0.2.1] - 2026-10-30

Released in lockstep with `@jsudc/server` 0.2.1; `@jsudc/core` stays 0.2.0 and
the peer range `^0.2.0` is unchanged.

### Added

- `--radius`, `--font-sans` and `--font-mono` are runtime theme tokens on
  `:root`, next to the colours (README "Theming"). The compiled stylesheet
  reads them as `var(--radius)` / `var(--font-sans)` / `var(--font-mono)`, so a
  host that sets `--radius: 0` and `--font-sans: serif` gets square corners and
  a serif font. Every `rounded-*` step is a multiple of `--radius` (default
  `0.5rem`, which renders exactly as 0.2.0).

### Changed

- The last literal radii and fonts are token-derived: the bare `rounded`
  utility, the checkbox and the Segmented items, and the Doc tab's code
  blocks. The `--udc-radius-*` variables are no longer emitted: they were
  never public names, only the stylesheet's internals; a host that set them
  sets `--radius` instead.

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

### Fixed

- **The declarations resolve under `moduleResolution: NodeNext`.** Every
  relative import in the `.d.ts` (and in the source) carries its `.js`
  extension; before, a host on NodeNext got `any` for the root and "no
  exported member" for `@jsudc/react/headless`, `/table` and the other
  subpaths (0.1.x had the same defect). `tsconfig.build.json` compiles under
  NodeNext so an import without the extension no longer builds, and
  `npm run check:types` (in CI and in the publish workflow) compiles
  `smoke/types.ts` against the built package under NodeNext and Bundler.

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

[Unreleased]: https://github.com/digital-cube/jsudc-react/compare/v0.8.0...HEAD
[0.8.0]: https://github.com/digital-cube/jsudc-react/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/digital-cube/jsudc-react/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/digital-cube/jsudc-react/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/digital-cube/jsudc-react/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/digital-cube/jsudc-react/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/digital-cube/jsudc-react/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/digital-cube/jsudc-react/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/digital-cube/jsudc-react/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/digital-cube/jsudc-react/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/digital-cube/jsudc-react/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/digital-cube/jsudc-react/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/digital-cube/jsudc-react/releases/tag/v0.1.0
