# AtlasTint

AtlasTint is a desktop-first, local-first interactive SVG atlas for marking geographic regions, tracking progress, and building deterministic personal maps.

The production v1 experience is complete for the currently registered World, Brazil, and Spain presets. These are catalog entries, not fixed product types: application state, import/export, the selector, loading, and rendering work from preset registrations and string stable IDs, so a future Australia- or Japan-only catalog does not require rewriting the product core.

## Product behavior

- Select a region directly on the SVG map or from the accessible region list.
- Search locally by canonical name, local name, alias, code, abbreviation, or parent group without a fuzzy-search dependency.
- Focus small regions without changing selection.
- See count, manifest-derived total, percentage, and progress immediately.
- Switch presets without mixing or losing their progress.
- Change supported projections without losing selections.
- Use hierarchical, single-accent, visit-chronology, or per-entity custom colors.
- Persist versioned progress locally and synchronize compatible cross-tab updates.
- Export geometry-free JSON and preview a validated import before atomic replacement.
- Reset one preset or all progress through confirmation dialogs.
- Use light, dark, or system appearance.

AtlasTint intentionally requires at least 1024 × 700 CSS pixels. Below either threshold it does not mount the workspace and automatically recovers when the viewport becomes supported.

## Setup

Requirements: a current Node.js LTS release, pnpm 11, Git, and a Chromium-based desktop browser for Playwright.

```bash
pnpm install
pnpm dev:web
```

Vite serves the web app on `http://localhost:3001` by default.

## Validation

Run the complete release gate with:

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

A preset registration declares its stable ID, display label, default projection, and lazy loader. The loaded preset supplies a validated manifest, geometry URL, attribution, fit policy, and optional inset definitions. The map engine does not branch on current preset IDs.

To add or replace a preset:

1. Define a curated manifest with application-owned stable IDs, names, aliases, codes, groups, parent relationships, totals, and projection support.
2. Add a deterministic source adapter to the geographic build pipeline. Verify the upstream archive checksum and normalize the source coordinate system before topology generation.
3. Generate the entity and parent TopoJSON collections and run all manifest-to-geometry invariants.
4. Create a lazy preset module that declares geometry, attribution, fit behavior, and any insets.
5. Add one registration to the preset catalog. Persistence defaults, selection UI, import previews, and loading derive from that catalog.
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

The authoritative local state uses storage key `atlas-tint:state` and schema version 1. It contains:

- active preset and theme preference;
- a record of per-preset progress keyed by preset ID;
- selected entity metadata with timestamp, deterministic order, and optional visit date;
- fill mode, custom colors, and projection preference.

Geometry, projected paths, hover state, open controls, search text, percentages, and transient errors are never persisted.

All reads and writes pass through a narrow persistence adapter. Zod validates the boundary, version-0 fixtures migrate explicitly, malformed or unavailable storage produces a usable warning state, rapid writes are coalesced, and `pagehide` flushes pending intent. Components never call `localStorage` directly.

Exports contain schema version, application version, timestamp, and validated progress only. Imports report incompatible data and unknown entity IDs, show a per-preset preview, and require confirmation before atomic replacement.

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

- V1 is desktop-only and deliberately provides no compressed mobile workspace.
- Visit dates are already supported by the persisted model but do not yet have an editing UI.
- JSON import replaces compatible local progress as one atomic operation rather than merging individual selections.
- The catalog currently ships three presets; there is no end-user preset installation UI.
- Political and administrative boundaries reflect the documented source versions and inclusion policies, not a claim that every boundary is universally uncontested.

## License

A project source-code license has not been selected. Geographic source rights and attribution requirements are independent and must be preserved; see [`ATTRIBUTIONS.md`](ATTRIBUTIONS.md).
