# AtlasTint

[![CI](https://github.com/martonpaulo/atlas-tint/actions/workflows/ci.yml/badge.svg)](https://github.com/martonpaulo/atlas-tint/actions/workflows/ci.yml)
[![Deploy GitHub Pages](https://github.com/martonpaulo/atlas-tint/actions/workflows/pages.yml/badge.svg)](https://github.com/martonpaulo/atlas-tint/actions/workflows/pages.yml)

[Open AtlasTint](https://atlastint.martonpaulo.com/) · [Report a bug](https://github.com/martonpaulo/atlas-tint/issues/new/choose)

AtlasTint is a desktop-first, local-first interactive SVG atlas for marking geographic regions, tracking progress, and building deterministic personal maps.

The current production experience covers the registered World, Brazil, and Spain presets. These are catalog entries, not fixed product types: application state, import/export, the selector, loading, and rendering work from preset registrations and string stable IDs, so a future Australia- or Japan-only catalog does not require rewriting the product core.

The durable product boundary and non-goals are recorded in [`docs/product.md`](docs/product.md).

## Product behavior

- Select a region directly on the SVG map or from the accessible region list.
- Search locally by canonical name, local name, alias, code, abbreviation, or parent group without a fuzzy-search dependency.
- Focus small regions without changing selection.
- See count, manifest-derived total, percentage, and progress immediately.
- Switch presets without mixing or losing their progress.
- Change supported projections without losing selections.
- Use hierarchical, single-accent, selection-order, or per-entity custom colors.
- Persist versioned progress locally and merge concurrent edits made in several tabs.
- Export geometry-free JSON and preview a validated import before atomic replacement.
- Reset one preset or all progress through confirmation dialogs.
- Use light, dark, or system appearance, stored in the same versioned record as everything else.

AtlasTint intentionally requires at least 1024 × 700 CSS pixels. Below either threshold it does not mount the workspace and automatically recovers when the viewport becomes supported.

## Setup

Requirements: a current Node.js LTS release, pnpm 11, Git, and a Chromium-based desktop browser for Playwright.

```bash
pnpm install
pnpm dev:web
```

Vite serves the web app on `http://localhost:3001` by default.

## Validation

Run the complete validation gate with:

```bash
pnpm validate
```

The gate runs, in order:

```bash
pnpm format
pnpm lint
pnpm check-types
pnpm test
pnpm geo:check
pnpm test:e2e
pnpm build
```

Focused commands are available for normal development. `pnpm test` runs Vitest unit and component tests; `pnpm test:e2e` runs the critical Playwright journeys.

`pnpm screenshots` captures the real application window for documentation, and `pnpm social-card` renders the 1200 × 630 social preview from the running application. The capture method and the rules it enforces are recorded in [`docs/screenshots.md`](docs/screenshots.md).

## Deployment

Every push to `main` runs the quality pipeline and publishes the production build to GitHub Pages. The site is served from the root of `atlastint.martonpaulo.com`, so Vite builds with the default base path `/` and routing, the favicon, and lazy-loaded map geometry resolve the same way at the hosted URL and at local development URLs.

CI spends effort in proportion to what changed. Formatting, lint, types, unit and component tests, geographic invariants, and the production build run on every push and pull request, because they observe everything. The Playwright suite downloads a browser and takes about a minute, so it runs only when something it can observe changed — application or package source, the geographic pipeline, dependency or tooling configuration, or the CI workflow itself. A documentation-only change skips it, says so in the run summary, and still reports a passing gate. When there is no comparable base to diff against, everything runs.

Dependency update proposals are grouped weekly for npm packages and GitHub Actions. Security reports use GitHub's private vulnerability-reporting channel.

## Current preset policies

The manifest, never the raw source feature count, defines selectable entities and progress totals.

### World

- 195 primary sovereign states: 193 UN member states, the Holy See, and the State of Palestine.
- Equal Earth is the default projection; Natural Earth, Robinson, and Mercator are available.
- Territories do not silently alter the primary total.
- Multi-polygon states remain one logical entity, and small states remain discoverable through search and focus.

### Brazil

- 26 states and the Federal District.
- Five official geographic regions act as deterministic color and selection groups.
- Full names and two-letter abbreviations are searchable.

### Spain

- 50 provinces plus Ceuta and Melilla.
- 17 autonomous communities plus the two autonomous cities are explicit parent groups.
- Parent selection selects all children; partial child selection exposes a native mixed state.
- Provincial and autonomous-community borders have separate visual weights.
- The Canary Islands, Ceuta, and Melilla use labeled, geometry-preserving insets; the Balearic Islands remain legible in their true main-map position.

## Preset model and adding another preset

A preset registration declares its stable ID, display label, default projection, and lazy loader. That much is eager, so persistence defaults and the preset selector exist before any map is downloaded. The lazily loaded preset supplies a validated manifest, a content-versioned geometry URL, attribution, fit policy, its own group palette, and optional inset definitions. The map engine does not branch on current preset IDs.

`loadPreset` checks the loaded module against its registration and refuses a preset whose manifest names a different stable ID, whose default projection disagrees with the catalog or is not among its own supported projections, or whose palette does not cover exactly the groups it renders. A missing hue is an error, not a silent fallback.

Projection IDs live in `domain.ts` and `projection-registry.ts` is typed against them, so a new projection cannot compile without both a display label and a D3 factory.

To add or replace a preset:

1. Define a curated manifest with application-owned stable IDs, names, aliases, codes, groups, parent relationships, totals, and projection support.
2. Add a deterministic source adapter to the geographic build pipeline. Verify the upstream archive checksum and normalize the source coordinate system before topology generation.
3. Generate the entity and parent TopoJSON collections and run all manifest-to-geometry invariants. The build records a digest of each artifact, and the browser requests geometry by that digest.
4. Create a lazy preset module that declares geometry, attribution, fit behavior, a hue for every group it renders, and any insets.
5. Add one registration to the preset catalog. Persistence defaults, selection UI, import previews, and loading derive from that catalog, and the contract check runs on load.
6. Add focused manifest, search, selection, rendering, and critical-journey coverage for the new policy.

Persisted preset data is a record keyed by stable preset ID rather than a fixed object with World, Brazil, and Spain fields. Unknown saved preset records remain non-fatal, while an unavailable active preset safely falls back to the catalog default.

## Stable geographic identity

Every selectable entity has an application-owned stable ID and an explicit geometry mapping. Display names, translations, array positions, path order, colors, and unnormalized upstream labels are never durable IDs.

The build pipeline validates:

- duplicate stable IDs;
- missing or unexpected selectable geometry;
- missing parent boundary meshes or non-mesh parent output;
- unresolved parent references;
- ambiguous normalized aliases;
- configured totals against manifests;
- decoded geometry with invalid globe-sized winding;
- deterministic source checksums and output metadata.

## Geographic data and regeneration

Source versions, checksums, retrieval details, and license terms are recorded in [`ATTRIBUTIONS.md`](ATTRIBUTIONS.md) and in generated map metadata.

Regenerate from the documented upstream sources:

```bash
pnpm geo:build
pnpm geo:check
```

For reproducible offline or repeated builds, place the verified archives in a cache directory using the filenames `world.zip`, `brazil.zip`, and `spain.zip`:

```bash
ATLAS_GEO_CACHE_DIR=/absolute/path/to/cache pnpm geo:build
pnpm geo:check
```

The pipeline verifies SHA-256 checksums before reading source files, keeps only mapped properties, combines multi-part entities, extracts parent boundary meshes from shared child arcs, quantizes shared arcs, simplifies conservatively, repairs only simplification-induced invalid winding, and emits deterministic TopoJSON plus transformation metadata. Heavy geometry work never runs in the browser.

## Persistence and imports

The authoritative local state uses storage key `atlas-tint:state` and schema version 2. It contains:

- active preset and theme preference;
- a record of per-preset progress keyed by preset ID;
- selected entity metadata with timestamp, deterministic order, and optional visit date;
- fill mode, custom colors, and projection preference.

Geometry, projected paths, hover state, open controls, search text, percentages, and transient errors are never persisted.

Two tabs share that one key, so every mutable field carries a Lamport stamp — a counter plus a
session-scoped actor ID — and deselections leave stamped tombstones. Merging is a per-field
decision rather than a whole-document one: independent edits in different tabs both survive,
a deselection is not undone by another tab's older copy, and a same-entity conflict resolves on
the greater counter, breaking ties on actor ID so every tab reaches the same answer. Wall-clock
timestamps are deliberately not used; two tabs' clocks are independent and can run backwards.
A pending write is rebased on whatever is durable at flush time, and a version-1 record migrates
with every field at the origin stamp, which loses to any later edit.

All reads and writes pass through a narrow persistence adapter. Zod validates the boundary, version-0 fixtures migrate explicitly, malformed or unavailable storage produces a usable warning state, rapid writes are coalesced, and `pagehide` flushes pending intent. Components never call `localStorage` directly.

AtlasTint deploys continuously and has no user-visible product version; workspace packages are private tooling metadata. Exports use independent envelope schema version 3 and contain a timestamp and validated progress, without an application release version. Imports accept legacy envelope schemas 1 and 2 (including their historical `applicationVersion` field) and the current envelope schema, report incompatible data and unknown entity IDs, and show a before-and-after table covering every stored category — the active preset, the appearance preference, and each preset's selected count, custom colours, colour mode, and projection — before an atomic replacement the user has to confirm.

An imported file is untrusted input, so it is bounded before it is read: at most 1 MiB, 32 preset records, 2,000 selections and 2,000 custom colours per preset, and 128-character keys. These are defensive headroom rather than supported product totals — a complete export of all 274 catalog entities, every one selected and coloured, is about 30 KB. A file over any bound is rejected whole; nothing is silently truncated.

## Architecture

The implementation keeps these concerns independent:

- catalog registration and preset manifests;
- source acquisition and generated geometry;
- projections, fitting, insets, and SVG path calculation;
- selection rules, search, deterministic colors, and progress formatting;
- durable state, migrations, storage, and import/export;
- transient pointer/search interaction and React presentation.

React owns the SVG DOM. D3 calculates projections, paths, centroids, and bounded zoom transforms. Geometry and projected paths never enter Zustand or browser storage. Pointer movement updates the tooltip through a ref instead of rerendering the application.

## Accessibility and visual system

The searchable entity list is the primary keyboard and screen-reader surface. The SVG has a useful title and description, but hundreds of pointer-only paths are excluded from the accessibility tree and tab order. Selection changes use a restrained live region; progress exposes native values; group states use native checkboxes and indeterminate state.

The interface follows one visual grammar: 8 px control corners, 12 px major surfaces and dialogs, and circles only for status or map markers. Low-frequency style and data controls remain collapsed so search, progress, the entity list, and the map dominate the workspace. Motion tokens collapse under `prefers-reduced-motion`.

## Known limitations

- AtlasTint is desktop-only and deliberately provides no compressed mobile workspace.
- Visit dates are already supported by the persisted model but do not yet have an editing UI, and they deliberately have no visual effect: the temporal fill mode is **Selection order**, which ranks the regions currently selected from *First marked* to *Most recently marked*. Deselecting closes the visual gap without renumbering stored history.
- JSON import replaces compatible local progress as one atomic operation rather than merging individual selections.
- The catalog currently ships three presets; there is no end-user preset installation UI.
- Political and administrative boundaries reflect the documented source versions and inclusion policies, not a claim that every boundary is universally uncontested.

## Discoverability

The deployed page carries its metadata statically in `index.html` rather than injecting it from the router, because social scrapers and most crawlers read the HTML without executing JavaScript. That covers the canonical URL, the complete `og:` and `twitter:` sets with the image's type and dimensions and alt text, `theme-color` for each color scheme, and `WebApplication` structured data. `sitemap.xml` points at the same canonical URL. GitHub Pages serves this repository at the `atlastint.martonpaulo.com` custom domain (`apps/web/public/CNAME`), so the canonical is `https://atlastint.martonpaulo.com/` — the address that answers 200.

## License

AtlasTint source code is available under the [`MIT License`](LICENSE). Geographic source rights and attribution requirements are independent and must be preserved; see [`ATTRIBUTIONS.md`](ATTRIBUTIONS.md).
