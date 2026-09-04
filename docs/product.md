# AtlasTint product definition

## What it is

AtlasTint is a desktop-first, local-first interactive atlas for privately selecting, coloring, searching, and revisiting geographic progress on curated SVG maps.

## Who it is for and the job

AtlasTint serves a person using a desktop browser who wants to mark and revisit geographic progress without creating an account or sending that history to a server. Without AtlasTint, that person would typically maintain a spreadsheet, annotate a static image, or repeatedly reconstruct the same list.

The product should make the geographic identity of every selectable region clear, keep progress durable on the device, and make the complete task available through both the map and an accessible searchable list.

## Outcomes

- Select and locate stable geographic entities on curated World, Brazil, and Spain presets.
- Search by canonical and local names, aliases, codes, abbreviations, and parent groups.
- Understand progress from manifest-derived totals and deterministic visual states.
- Preserve independent progress and preferences for each preset across reloads.
- Export validated, geometry-free progress and preview it before destructive replacement.
- Complete the core workflow with keyboard and screen-reader-accessible controls.

## Non-goals

- **Accounts, a backend, or cloud synchronization:** local storage protects privacy and keeps operation simple; multi-device collaboration is not the product's job.
- **A compressed mobile workspace:** the map and dense editing surface require a supported desktop viewport to remain legible and operable.
- **End-user installation of arbitrary map datasets:** curated manifests and reproducible preprocessing protect geographic identity and progress totals.
- **A general-purpose image or cartographic publishing editor:** AtlasTint tracks and visualizes geographic progress rather than replacing illustration or GIS software.
- **A claim that political boundaries are universally uncontested:** every preset follows its documented source version and explicit inclusion policy.
- **User-visible product releases:** the hosted application updates continuously; compatibility is governed by explicit persistence and import schema versions.

## Success signal

AtlasTint succeeds when the intended user can select, search, focus, persist, reset, export, and import progress across every supported preset entirely on the local device, without needing an account, spreadsheet, or image editor. No numeric adoption target is asserted without real usage evidence.

## Fixed constraints

- Desktop browser viewport of at least 1024 by 700 CSS pixels.
- Local-first operation with no backend, authentication, analytics, or telemetry.
- Geographic identity, persistence integrity, and accessible interaction outrank implementation speed or additional features.
- Current product copy is English (`en-US`).
- Browser acceptance targets the Chromium engine through Chromium for Testing; Brave is not an acceptance browser.
- Geographic data remains curated, attributed, reproducible, and separate from durable user state.
