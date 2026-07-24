# Geographic data attribution

AtlasTint commits optimized derived TopoJSON rather than unexplained raw archives. The deterministic build records these source versions and verifies the archives before processing them.

## World sovereign states

- Source: Natural Earth Admin 0 Countries, version 5.1.1, 1:50m
- Archive: `https://naciscdn.org/naturalearth/50m/cultural/ne_50m_admin_0_countries.zip`
- SHA-256: `5fed433373581fa648920435f937d95f2d3c0200e067409c6478dcdf1b853139`
- Terms: Natural Earth data is in the public domain.
- Product policy: the curated manifest selects 195 sovereign states; the upstream feature count does not define progress.

## Brazilian federative units

- Source: IBGE Malha Municipal Digital 2024 — Unidades da Federação
- Archive: `https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_municipais/municipio_2024/Brasil/BR_UF_2024.zip`
- SHA-256: `be61a1e11bf86b265098b5a0b02eb836237421ad73354b1f0892fb6be4598866`
- Terms: public IBGE geographic data; preserve IBGE attribution and applicable use terms.
- Product policy: 26 states and the Federal District, grouped by the five official geographic regions.

## Spanish provinces and autonomous cities

- Source: IGN/CNIG Base de Datos de Divisiones Administrativas de España provincial enclosures, published 2026-02-12
- Retrieval endpoint: `https://centrodedescargas.cnig.es/CentroDescargas/descargaDir`
- Retrieval form body: `secDescDirLA=9000029&secuencial=9000029`
- SHA-256: `d2c5ee140e7f48b3a5fc177b7c2bb05b757472e349290d0d0065d9c562f891da`
- Terms: derived work of BDLJE under CC BY 4.0; attribution `ign.es`.
- Coordinate systems: peninsular/Balearic/Ceuta/Melilla source geometry is ETRS89 (EPSG:4258); Canary geometry is REGCAN95 (EPSG:4081). Both are geographic longitude/latitude and are used directly as WGS84-compatible coordinates at this atlas scale; no projected-coordinate conversion is applied.
- Product policy: 50 provinces plus Ceuta and Melilla, grouped by 17 autonomous communities and two autonomous cities.

## Transformations

The preprocessing pipeline maps upstream identifiers to application-owned stable IDs, removes unused properties, combines multi-part entities, extracts parent boundary meshes from shared child arcs, preserves shared topology, quantizes coordinates, simplifies conservatively with spherical weights, rejects invalid manifest/geometry mappings, and removes a ring only when simplification has collapsed its winding into an impossible globe-sized complement. Generated metadata records the exact thresholds and source checksums used for each build.
