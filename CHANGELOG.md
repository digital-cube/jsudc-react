# Changelog

All notable changes to `@jsudc/react` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the package uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). `@jsudc/core`,
`@jsudc/server` and `@jsudc/react` share one version line and release together.

## [Unreleased]

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

### Added

- `UrlStateAdapter`, `UdcUrlStateProvider`, `useUrlSearchParams()`
  (`[params, setParams]`, react-router's shape), `useUrlStateAdapter()` and
  `windowLocationAdapter`, from the package root.
- The `@jsudc/react/react-router` subpath (`dist/react-router.js`) with
  `UdcReactRouterUrlState`.
- README: a "URL state" section — the default, the react-router adapter,
  writing one for Next.js or TanStack Router.

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

[Unreleased]: https://github.com/digital-cube/jsudc-react/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/digital-cube/jsudc-react/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/digital-cube/jsudc-react/releases/tag/v0.1.0
