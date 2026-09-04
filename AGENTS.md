# AtlasTint — rules for coding agents

## Project identity and policy

- Project name: `atlas-tint`
- Public name: `AtlasTint`
- Benefit-first description: A local-first interactive SVG atlas for selecting, coloring, and tracking geographic regions.
- Repository: `martonpaulo/atlas-tint` (public)
- Public identifiers: GitHub repository `martonpaulo/atlas-tint` and Pages site `https://martonpaulo.github.io/atlas-tint/`; workspace packages are private.
- Landing page: GitHub Pages at `https://martonpaulo.github.io/atlas-tint/`, built from `main`.
- License: `MIT`
- Copyright: 2026 Marton Paulo
- Development language: English.
- Product copy: English (`en-US`) is the source and fallback language; add localization only through an explicit product request.
- Browser acceptance: Chromium only; automated and manual browser checks use Chromium for Testing, never Brave.
- Branch policy: Agents work on issue branches and deliver through pull requests; unattended AO branches carry the required session prefix.
- Commit policy: Commit completed, validated task work automatically using focused Conventional Commits.
- Push policy: Push completed, validated issue branches automatically; never push directly to `main`.
- Product versioning: Continuous deployment without a user-visible product version; persistence and import schema versions remain explicit and independent.
- Agent automation: `enabled`
- Agent automation scope: Local Agent Orchestrator only. Remote GitHub Actions lifecycle automation is not configured or required; [issue #46](https://github.com/martonpaulo/atlas-tint/issues/46) preserves it as an optional future decision with owner-only credential prerequisites.
- Implementation agent: `claude`
- Review agent: `codex`
- Orchestration agent: `codex`
- Merge policy: squash pull requests into `main`; direct pushes to `main` are forbidden for agents.
- Commit subject: a commit made for an issue ends with `(#<issue number>)`.
- Delete branches after merge: enabled.
- Release, signing, and secret-storage policy: GitHub Pages deploys continuously from `main`; there are no tags, releases, downloadable artifacts, signing identity, or remote agent credentials required by the supported local automation.
- Skills baseline revision: `9026cafb46c2bae55a3e7415eb475ce437ff1c1a`
- Skills baseline applied: `2026-09-04`

Treat these values as stable project decisions. Change an identifier, license, visibility, branch policy, localization strategy, landing-page contract, automation state, or distribution policy only through an explicit migration task.

## Instruction hierarchy and sources of truth

- Follow the direct task, the most specific scoped instructions, this root file, and then general working agreements, in that order.
- Code is evidence of current behavior. `AGENTS.md` is normative for process. An approved issue specification is normative for desired behavior.
- Surface conflicts among code, guidance, and approved specifications; do not silently choose one as universally authoritative.
- Keep one canonical owner for each rule. Secondary documents summarize or link instead of duplicating it.
- Do not turn an audit, research pass, review, or analysis into implementation without the workflow authorization that owns the next phase.

## Product mission

AtlasTint is a desktop-first, local-first web application for selecting, coloring, searching, and tracking geographic regions on high-quality interactive SVG maps.

Initial presets:

- World sovereign states
- Brazilian federative units
- Spanish provinces, autonomous communities, and autonomous cities

The product priority order is fixed:

1. Correct geographic identity and selection behavior
2. Reliable persistence and data integrity
3. Clear, fast, accessible interaction
4. Excellent visual hierarchy and cartographic legibility
5. Runtime performance
6. Implementation speed and maintainability
7. Additional features

Do not trade a higher-priority item for a lower-priority item.

## Mandatory workflow

- Start issue work from current `main`, create the recorded issue branch, and deliver through a pull request. Never push directly to `main`.
- Read this file before making changes.
- Search before adding code. Reuse established components, tokens, schemas, map abstractions, utilities, state actions, and tests.
- Read only the minimum relevant files or chunks before editing.
- Keep changes focused on the requested scope. Do not perform unrelated cleanup, dependency upgrades, broad refactors, or formatting churn.
- Do not overwrite, revert, reformat, or discard user changes.
- Prefer the simplest implementation that completely satisfies the product requirement.
- Do not stop for minor uncertainty. Make a reversible, documented decision and continue.
- Ask before introducing a new architectural or visual pattern when an existing pattern could reasonably serve the same purpose.
- When proposing a new pattern, report:
  - the existing pattern
  - the limitation
  - the proposed replacement or extension
  - the migration scope
  - why the change is worth its complexity
- Never claim completion from visual inspection alone. Validate behavior, types, tests, build, accessibility, persistence, and map data invariants.

## Long-running operations

- Use bounded yields or status tools and wait for observable state instead of arbitrary sleeps.
- Report useful progress at least once per minute when the client supports it.
- Inspect current output and state before interrupting, retrying, or changing approach.
- Interrupt only for a verified stall, an expired deadline, or cost and risk that no longer justify continuing.
- After interruption, preserve useful state, explain the evidence, and choose a narrower retry or explicit blocker. Never rerun the same unchanged failure.

## Agent instruction files

- `AGENTS.md` is the source of truth.
- Keep a root `CLAUDE.md` symbolic link pointing to `AGENTS.md`.
- Add folder-specific `AGENTS.md` files only when a subtree genuinely requires different rules.
- Every folder-specific `AGENTS.md` must have a sibling `CLAUDE.md` symbolic link pointing to it.
- Do not duplicate the same rules across instruction files.

## Agent skill paths

- Product definition: `docs/product.md`
- Domain glossary: `CONTEXT.md` (optional; create only when useful)
- ADRs: `docs/adr/` (create only when recording a durable architectural decision)
- Research notes: `docs/research/` (create only when persisting research)
- Handoffs: `.scratch/handoffs/`
- Prototypes: `.scratch/prototypes/`

## Frozen technical direction

Use the scaffolded versions unless a task explicitly requires an upgrade.

- React 19
- TypeScript in strict mode
- Vite
- TanStack Router with file-based routing
- Tailwind CSS v4
- shadcn/ui using Base UI primitives
- Zustand for genuinely shared client state
- Zod for persisted and imported data validation
- D3 Geo for projection and SVG path calculation
- `d3-geo-projection` for additional projections
- `d3-zoom` only for map zoom and pan behavior
- TopoJSON in static assets, converted with `topojson-client`
- Biome for formatting and linting
- Vitest and React Testing Library
- Playwright for critical end-to-end behavior
- pnpm

Do not add without an explicit, demonstrated need:

- backend or server runtime
- database or ORM
- authentication
- React Query
- Axios
- Redux
- Mapbox, Google Maps, Leaflet, OpenLayers, or tile services
- canvas or WebGL map rendering
- PWA or service worker support
- analytics or telemetry
- animation libraries
- CSS-in-JS
- Storybook
- a second component library
- a second state-management library
- a second validation library
- a second formatter or linter
- Turborepo or Nx

## Dependency policy

- Prefer browser APIs and small focused packages.
- Before adding a dependency, verify that the existing stack or platform cannot solve the problem cleanly.
- Explain why a new runtime dependency is required and which existing alternatives were rejected.
- Do not add a dependency for a one-function utility.
- Import only the D3 modules needed. Never depend on the umbrella `d3` package.
- Keep geographic preprocessing dependencies in development tooling, not in the browser bundle.
- Do not duplicate shadcn conventions with parallel class-merging or variant systems.
- Use the scaffolded `cn()` helper and the variant utility already used by shadcn components.
- Do not introduce `tailwind-variants` or a second `tailwind-merge` abstraction unless replacing the current convention is explicitly approved.

## Architecture boundaries

Keep these concerns independent:

- geographic source data
- optimized geometry assets
- entity manifests and stable identifiers
- projections and viewport fitting
- selection rules
- search and aliases
- color assignment
- durable progress state
- transient interaction state
- persistence and migrations
- import and export
- React presentation

Rules:

- Business rules must not live in route components or visual components.
- Components render prepared state and dispatch explicit actions.
- Keep reusable pure logic independent from React.
- Keep local interaction state local.
- Use Zustand only when ownership spans multiple independent UI surfaces or must persist.
- Derive values instead of storing synchronized duplicates.
- Do not store map geometry, projected paths, search results, percentages, or other derivable data in Zustand.
- Do not store geographic geometry in `localStorage`.
- Keep infrastructure errors behind typed, actionable domain or UI results.
- Model impossible states out with discriminated unions, exhaustive handling, and narrow public APIs.

## Geographic data contract

Every preset must define a curated manifest. The manifest, not the raw geometry source, determines what is selectable and what counts toward progress.

Each selectable entity needs:

- a stable application-owned ID
- a stable geometry mapping
- canonical display name
- local-language names where relevant
- useful aliases
- standard code or abbreviation where available
- parent group where applicable
- explicit selectability

Never use these as durable IDs:

- translated display names
- array positions
- SVG path order
- color values
- unstable upstream labels without normalization

A multi-polygon entity is one logical entity. Selecting any polygon selects the whole entity.

Validate at build time or in the preprocessing pipeline that:

- every manifest entity expected to render has geometry
- every selectable geometry maps to exactly one intended entity
- no duplicate stable IDs exist
- no unexpected selectable geometry enters the application
- all parent references resolve
- every alias normalizes predictably
- configured totals equal the manifest-derived totals

## Preset policy

### World

- Default projection: Equal Earth.
- Optional projections: Natural Earth, Robinson, and Mercator.
- Primary progress policy: 195 sovereign states, defined in the preset manifest as the 193 UN member states plus the Holy See and the State of Palestine.
- Do not derive the total from the number of Natural Earth features.
- Territories and disputed geometries may be visible when necessary for map continuity, but they must not silently change the primary total.
- Any selectable non-primary entity requires an explicit documented policy.
- Preserve important islands and multi-polygon states.
- Small states must remain discoverable through search, focus, and optional callouts. Do not distort their real geometry merely to create a larger click target.

### Brazil

- Primary selectable units: 26 states and the Federal District.
- Parent groups: the five official geographic regions.
- Search must support full names and two-letter abbreviations.
- Use official or official-derived IBGE territorial meshes.

### Spain

- Primary progress units: 50 provinces plus Ceuta and Melilla as autonomous cities.
- Parent groups: 17 autonomous communities, with autonomous cities represented according to the preset manifest.
- Selecting a parent selects all of its selectable children.
- Partial child selection produces an indeterminate parent state.
- Provincial borders are visually lighter than autonomous-community borders.
- Include mainland Spain, Balearic Islands, Canary Islands, Ceuta, and Melilla.
- Use clearly labeled insets where required for legibility.
- Support Spanish names and relevant co-official local names and aliases.
- Use official or official-derived IGN/CNIG or INE boundary data.

## Geographic preprocessing

Heavy geometry work must happen before runtime.

The reproducible preprocessing pipeline must:

1. obtain or read the documented source dataset
2. verify the source version and attribution
3. normalize coordinate reference systems when necessary
4. map source identifiers to stable application IDs
5. remove unused properties
6. repair or reject invalid geometry deliberately
7. simplify conservatively
8. preserve shared borders
9. convert optimized assets to TopoJSON
10. run manifest and geometry invariants
11. produce deterministic output
12. record source and transformation metadata

Do not:

- simplify geometry on every browser load
- commit unexplained third-party files
- ship enormous raw datasets to the browser
- silently edit political boundaries
- silently drop small islands or enclaves
- treat generated geographic assets as hand-edited source files

Generated assets must be reproducible. Their checksums should remain stable when inputs and preprocessing options are unchanged.

## SVG and D3 rules

- React owns the SVG DOM.
- D3 calculates projections, paths, bounds, centroids, and zoom transforms.
- Do not let D3 create and mutate the full component tree imperatively.
- Use an SVG `viewBox` and preserve vector rendering.
- Calculate projected geometry only when preset, geometry, projection, or viewport configuration changes.
- A selection toggle must not recompute unrelated path data.
- Isolate high-frequency pointer and tooltip state from the main application store.
- Avoid updating React state on every pointer-move event when a ref or CSS transform is sufficient.
- Keep zoom transforms bounded and deterministic.
- Fit-to-view must account for configured insets and safe padding.
- Use `vector-effect="non-scaling-stroke"` where appropriate to preserve boundary legibility during zoom.
- Dynamic SVG `d`, transform values, calculated dimensions, and dynamic CSS custom properties are legitimate inline values. Static presentation belongs in semantic styles and tokens.

## Search rules

Search must be local, immediate, deterministic, and dependency-free unless profiling proves otherwise.

Normalize shared search text by:

- Unicode normalization
- case folding
- diacritic removal
- whitespace normalization
- punctuation normalization where appropriate

Search across:

- canonical name
- localized names
- aliases
- ISO or administrative codes
- abbreviations
- parent group names

Ranking order should normally favor:

1. exact canonical or code match
2. exact alias match
3. prefix match
4. token-prefix match
5. substring match

Do not add fuzzy-search dependencies for the initial product.

Search interactions must support:

- keyboard navigation
- Enter to toggle or activate the focused result
- Escape to clear or close predictably
- map highlighting
- map focus without changing selection
- parent context in each result

## State and persistence

Persist only durable user intent:

- selected entity IDs
- selection metadata such as order and selected timestamp
- optional visit date
- fill mode
- custom colors
- active preset
- projection preference
- theme preference
- non-sensitive UI preferences that should survive reloads

Do not persist:

- geometry
- projected SVG paths
- hover state
- open popovers
- current tooltip
- temporary search text unless intentionally specified
- calculated percentages
- transient errors

Persistence requirements:

- one versioned schema
- Zod validation at the storage boundary
- explicit migrations
- safe fallback for malformed JSON
- safe behavior when browser storage is unavailable or quota-limited
- unknown entity IDs ignored or reported, never fatal
- writes coalesced when rapid changes would otherwise create unnecessary work
- cross-tab synchronization through the native `storage` event when useful
- no credentials or sensitive data in browser storage

Components must not call `localStorage` directly. Use a persistence adapter with narrow typed methods.

Import and export requirements:

- JSON only for the initial implementation
- schema version
- application version
- export timestamp
- validated preset progress
- preview before destructive replacement
- clear validation errors
- no raw map geometry in exports

## React and TypeScript conventions

- Use strict modern TypeScript.
- Never use `any`.
- Avoid unsafe assertions. Validate at boundaries and narrow types.
- Use `import type` for type-only imports.
- Use named exports. Do not use default exports except where a framework-generated convention strictly requires one.
- Use lowercase kebab-case file names.
- Do not create barrel files for internal folders.
- Prefer absolute imports through the configured alias.
- Do not use `React.FC`.
- React 19 code must not introduce unnecessary `forwardRef` wrappers.
- Extend native element props when building native-element wrappers.
- Place the props spread last unless a deliberate protected prop must override consumer input.
- Keep public component APIs small and composable.
- Prefer composition over boolean-prop matrices.
- Pure functions use explicit inputs and outputs and do not read global state.
- Keep sorting, filtering, formatting, mapping, normalization, migrations, and color assignment in shared pure functions.
- Comments explain non-obvious constraints or provenance, not what the syntax already says.

## Component and styling conventions

- Prefer semantic HTML and native browser behavior.
- Use shadcn/Base UI primitives for complex accessible behavior instead of rebuilding dialogs, menus, selects, tooltips, or popovers.
- Use native elements when a primitive adds no value.
- Use the existing `cn()` helper for class composition.
- Use the project’s established variant utility for finite visual variants.
- Add `data-slot` to reusable component parts.
- Express states through native attributes and meaningful `data-*` attributes.
- Icon-only buttons require an accessible name.
- Every interactive element requires visible `:focus-visible` treatment.
- Do not use generic `div` elements as buttons, links, checkboxes, or listbox options.

All reusable visual values must come from semantic design tokens where practical:

- color
- typography
- spacing
- size
- radius
- shadow
- border width
- motion duration
- easing
- map fill
- map boundary
- focus treatment
- selected treatment
- tooltip surface

Do not introduce one-off hardcoded hex values or arbitrary dimensions when an existing semantic token fits.

## Visual direction

The product is an editorial cartography workspace, not a generic SaaS dashboard.

Maintain one visual direction through delivery:

- map-first composition
- spacious but information-dense desktop layout
- warm neutral canvas
- crisp geographic outlines
- restrained saturation
- deterministic semantic palettes
- strong type hierarchy
- subtle depth
- deliberate light and dark themes
- minimal ornament

Avoid:

- glassmorphism
- neon gradients
- random rainbow fills
- gratuitous animation
- excessive cards inside cards
- tiny low-contrast labels
- decorative charts unrelated to map progress
- large empty hero sections inside the application
- redesigning the visual language during unrelated tasks

The map should own most of the viewport. Controls must remain discoverable without competing with geography.

## Color system

Default mode: hierarchical deterministic palette.

- World base hue comes from continent or documented geographic group.
- Brazil base hue comes from official geographic region.
- Spain base hue comes from autonomous community.
- Child variation is deterministic and independent of selection order.
- Unselected regions use a neutral semantic fill.
- Hover, focus, selected, partial, and unavailable states must be distinguishable.
- Selection cannot rely on color alone.
- Custom colors must still preserve readable boundaries and focus indication.

Supported modes:

- hierarchical palette
- single accent with deterministic tonal variation
- visit chronology
- per-entity custom color

Never generate random colors at render time.

## Desktop support and responsive behavior

The application is intentionally desktop-only for the initial product.

Minimum supported viewport:

- width: 1024 CSS pixels
- height: 700 CSS pixels

Below either threshold:

- do not render the main workspace
- render a polished, accessible explanation
- state that a larger browser window or desktop display is required
- reevaluate when the viewport changes
- do not use user-agent sniffing as the primary gate

Desktop-only does not mean fixed-pixel layout. Support:

- browser zoom
- different desktop aspect ratios
- split-screen desktop use when still above the minimum
- intrinsic sizing
- CSS Grid and Flexbox
- logical properties
- overflow without clipped controls

Do not create a hidden or broken mobile version.

## Accessibility

The searchable entity list is the primary keyboard and screen-reader interaction surface.

- Do not place hundreds of SVG paths into the tab order.
- The SVG must expose a useful title, description, and current preset context.
- All map actions must have an equivalent accessible list action.
- Announce meaningful selection changes through a restrained live region.
- Progress must expose current value, minimum, maximum, and readable text.
- Parent partial selection must expose its mixed state.
- Tooltips cannot contain information unavailable elsewhere.
- Preserve keyboard navigation, visible focus, zoom support, reduced motion, and sufficient contrast.
- Do not rely only on hover.
- Respect `prefers-reduced-motion`.
- Test at 200% browser zoom within the supported desktop viewport when practical.

## Performance

Optimize for real interaction latency, not theoretical micro-optimizations.

- Lazy-load each preset and its geometry.
- Do not load all maps at startup.
- Do not put large GeoJSON or TopoJSON objects in global state.
- Avoid global rerenders during hover, pointer movement, or tooltip positioning.
- Precompute or memoize only clearly expensive stable calculations.
- Do not scatter defensive `useMemo` and `useCallback` everywhere.
- Avoid blocking the main thread with runtime geometry simplification or broad data transformation.
- Use code splitting for non-initial routes and preset bundles.
- Keep the initial route useful before optional presets finish loading.
- Inspect the production bundle and generated asset sizes before completion.

Review and justify:

- initial JavaScript exceeding 300 KB gzip
- any individual compressed map asset exceeding 1.5 MB
- long tasks exceeding 50 ms during normal selection or search
- interaction latency visibly above one animation frame for ordinary toggles

These are review thresholds, not reasons to destroy geographic quality blindly.

## Error, empty, and loading states

Every user-visible asynchronous or fallible operation needs an intentional state:

- preset loading
- preset load failure
- missing geometry
- unavailable storage
- malformed persisted state
- unsupported future schema
- invalid import
- partial import compatibility
- empty search results
- no regions selected
- unsupported viewport

Do not silently swallow errors. Provide a recovery action when one exists.

## Testing strategy

Use the lowest-cost test that proves the behavior.

### Unit tests

Required for complex or durable pure logic, including:

- search normalization and ranking
- aliases and abbreviations
- percentage formatting
- deterministic color assignment
- hierarchical parent/child selection
- mixed parent state
- persistence serialization
- schema migrations
- malformed storage recovery
- import validation
- unknown entity handling
- manifest and geometry invariants
- projection preference persistence

### Component tests

Use accessible queries to verify:

- selecting from search
- selecting from the list
- progress updates
- parent mixed state
- destructive confirmation
- keyboard behavior
- unsupported viewport handling
- storage failure messaging

### End-to-end tests

Keep Playwright focused on critical journeys:

- select an entity on the map
- select an entity through search
- reload and retain progress
- switch presets without data loss
- change world projection without losing selection
- select and partially deselect a Spanish parent group
- export and import valid progress
- reject invalid import data
- display and recover from the unsupported viewport screen
- preserve behavior in light and dark themes

For bug fixes, add a focused regression test when practical and ensure it would fail for the original defect.

Avoid tests that mirror implementation details, duplicate constants, or merely test framework behavior.

## Validation order

Run the narrowest relevant validation first, then expand according to scope.

Before completion, the full project must pass:

1. formatting check
2. lint
3. TypeScript check
4. unit and component tests
5. geographic data invariant checks
6. Playwright critical journeys
7. production build
8. bundle and asset inspection

Inspect a failure before rerunning. Never rerun an unchanged failed command without a relevant code, configuration, environment, or test change.

## Artifacts and temporary processes

- Store screenshots, traces, logs, coverage output, generated reports, and temporary validation files only under `artifacts/`.
- Do not delete pre-existing artifacts or user files.
- Remove current-task temporary artifacts before closeout unless they are a requested deliverable or needed as failure evidence.
- Stop development servers, preview servers, test watchers, browser sessions, and other task-specific processes before finishing.

## Documentation

Document durable decisions and policies, not a brittle inventory of exact directories and filenames.

Documentation must explain:

- product behavior
- geographic inclusion policy
- source attribution and versions
- stable ID rules
- persistence schema and migration policy
- how to regenerate map assets
- how to add a preset
- architectural boundaries
- quality and validation commands

Do not document an exact code tree unless it is generated or automatically verified. File-layout documentation becomes stale quickly.

## Durable project learning

- Propose durable documentation only for learning that is verified, project-specific, likely to recur, and absent from its canonical owner.
- State the evidence, canonical owner, smallest change, exact draft, and requested decision before writing an adjacent learning outside the current scope.
- Do not persist hypotheses, raw logs, issue-specific implementation detail, credentials, personal data, or machine-specific paths as project guidance.
- Documentation required by the selected behavior remains part of that task and needs no additional approval.

## User attention

- Use a proposed-issue notice for distinct evidence-backed work outside the accepted scope.
- Use a decision notice for materially different outcomes that repository evidence cannot settle.
- Use an approval notice for an exact external, destructive, privacy, cost, or publication boundary.
- Use an action-needed notice when only the owner can perform the required external step.
- Each notice names the evidence, impact, recommendation, exact requested response, and what permits work to resume. Never hide a required response in a general summary.

## Agent execution

Rules for any executor working from a clone of this repository, including cloud executors that read only committed files.

- Run tests with `pnpm validate`; run lint with `pnpm lint`. A change is not done while either fails on the exact current head.
- Branch as `<type>/<agent>/issue-<n>/<short-slug>`; commit with Conventional Commits, subject ending in `(#<n>)`.
- Never push to `main` and never merge: open a pull request and stop. Merge belongs to the owner or the orchestration workflow recorded in `.ao/worker-rules.md`.
- Start the PR body with one `Closes #<n>` line per resolved issue, then the problem, implementation, tests with results, and residual risk.
- Do not touch: `.ao/**`, `.github/workflows/**`, `docs/product.md`, `LICENSE`, or `ATTRIBUTIONS.md`.
- `AGENTS.md` is protected by section, not as a file. `## Project identity and policy` is governance and never changes under an executor. Other sections change only when the accepted implementation makes a recorded project pattern untrue.
- When a required product decision is absent from the issue, publish the exact question, apply `status: needs-decision` with `in-progress`, verify both labels, and stop instead of guessing.

## Git and delivery

- Use focused Conventional Commits in English.
- Use one issue branch per coherent delivery group and follow the recorded naming convention.
- Inspect the diff before committing.
- Remove debug code and unrelated generated changes.
- Commit and push the issue branch after the requested scope is complete and validated, unless the user explicitly says not to push.
- Never push directly to `main`; open a pull request with the complete closing issue set.
- If push is unavailable, report the exact reason without claiming success.

The final report must include:

- implemented behavior
- important technical decisions
- changed files
- validation commands and results
- accessibility, performance, and data-integrity considerations
- created or retained artifacts
- commit hash and message
- push status
- final git status
- unrelated dirty or untracked files
- remaining risks, limitations, and unvalidated areas
