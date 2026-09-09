import type { Feature, Geometry } from "geojson";
import { describe, expect, it } from "vitest";

import { validatePresetBundle } from "@/features/atlas/bundle";
import type { PresetManifest } from "@/features/atlas/domain";
import type {
	EntityGeometryProperties,
	GeometryBundle,
	ParentGeometryProperties,
} from "@/features/atlas/geometry";
import { spainPreset } from "@/features/atlas/presets/spain";

const point: Geometry = { type: "Point", coordinates: [0, 0] };

function entityFeature(
	properties: Partial<EntityGeometryProperties> & { id: string },
): Feature<Geometry, EntityGeometryProperties> {
	return {
		type: "Feature",
		geometry: point,
		properties: {
			geometryId: properties.id,
			groupId: "group",
			inset: null,
			...properties,
		},
	};
}

function bundleFor(
	manifest: PresetManifest,
	overrides: Partial<{
		entities: Feature<Geometry, EntityGeometryProperties>[];
		parents: Feature<Geometry, ParentGeometryProperties>[];
	}> = {},
): GeometryBundle {
	return {
		entities: {
			type: "FeatureCollection",
			features:
				overrides.entities ??
				manifest.entities.map(({ id, geometryId, groupId }) =>
					entityFeature({ id, geometryId, groupId }),
				),
		},
		parents: {
			type: "FeatureCollection",
			features:
				overrides.parents ??
				manifest.parents.map(({ id }) => ({
					type: "Feature",
					geometry: point,
					properties: { id, inset: null },
				})),
		},
	};
}

describe("preset bundle validation", () => {
	const manifest = spainPreset.manifest;

	it("accepts a manifest and geometry from the same generation", () => {
		expect(validatePresetBundle(manifest, bundleFor(manifest))).toEqual({
			ok: true,
		});
	});

	it("refuses a topology that is missing a selectable region", () => {
		const bundle = bundleFor(manifest);
		bundle.entities.features = bundle.entities.features.slice(1);
		const result = validatePresetBundle(manifest, bundle);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.mismatches).toEqual([
			{ code: "missing-geometry", ids: [manifest.entities[0].id] },
		]);
		expect(result.message).toContain(manifest.shortName);
		expect(result.message).toContain("different build");
	});

	it("refuses geometry the region list does not know about", () => {
		const bundle = bundleFor(manifest);
		bundle.entities.features.push(entityFeature({ id: "es-99" }));
		const result = validatePresetBundle(manifest, bundle);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.mismatches).toContainEqual({
			code: "unexpected-geometry",
			ids: ["es-99"],
		});
	});

	it("refuses a region wired to different source geometry or group", () => {
		const bundle = bundleFor(manifest);
		bundle.entities.features[0].properties.geometryId = "99";
		bundle.entities.features[1].properties.groupId = "es-elsewhere";
		const result = validatePresetBundle(manifest, bundle);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.mismatches).toContainEqual({
			code: "geometry-id-mismatch",
			ids: [manifest.entities[0].id],
		});
		expect(result.mismatches).toContainEqual({
			code: "group-mismatch",
			ids: [manifest.entities[1].id],
		});
	});

	it("refuses a preset whose parent boundary mesh is absent", () => {
		const bundle = bundleFor(manifest, { parents: [] });
		const result = validatePresetBundle(manifest, bundle);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.mismatches).toContainEqual({
			code: "missing-parent-boundary",
			ids: manifest.parents.map(({ id }) => id),
		});
	});

	it("names at most five regions so one broken deploy stays readable", () => {
		const bundle = bundleFor(manifest, { entities: [] });
		const result = validatePresetBundle(manifest, bundle);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.message).toContain(
			`and ${manifest.entities.length - 5} more`,
		);
	});
});
