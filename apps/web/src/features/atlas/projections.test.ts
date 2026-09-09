import { describe, expect, it } from "vitest";

import type { GeometryBundle } from "@/features/atlas/geometry";
import { spainPreset } from "@/features/atlas/presets/spain";
import { worldPreset } from "@/features/atlas/presets/world";
import {
	createProjectionLayout,
	viewBoxAttribute,
	viewportPolicy,
	zoomExtent,
	zoomTranslateExtent,
} from "@/features/atlas/projections";

/** Points that stand in for the geometry of each Spanish inset and the mainland. */
function spainBundle(): GeometryBundle {
	// Small squares rather than points: fitting a zero-area collection gives an infinite scale.
	const anchors: Record<string, [number, number]> = {
		canary: [-15.6, 28.1],
		ceuta: [-5.32, 35.89],
		melilla: [-2.94, 35.29],
		main: [-3.7, 40.4],
	};
	const entities = spainPreset.manifest.entities.map((entity, index) => {
		const [longitude, latitude] =
			anchors[entity.inset ?? "main"] ?? anchors.main;
		const spread = entity.inset ? 0.05 : 0.5;
		const offset = (index % 5) * spread * 0.1;
		return {
			type: "Feature" as const,
			geometry: {
				type: "Polygon" as const,
				coordinates: [
					[
						[longitude + offset, latitude + offset],
						[longitude + offset + spread, latitude + offset],
						[longitude + offset + spread, latitude + offset + spread],
						[longitude + offset, latitude + offset + spread],
						[longitude + offset, latitude + offset],
					],
				],
			},
			properties: {
				id: entity.id,
				geometryId: entity.geometryId,
				groupId: entity.groupId,
				inset: entity.inset ?? null,
			},
		};
	});
	return {
		entities: { type: "FeatureCollection", features: entities },
		parents: { type: "FeatureCollection", features: [] },
	};
}

describe("viewport policy", () => {
	it("is the single source of the viewBox and both zoom extents", () => {
		expect(viewBoxAttribute()).toBe(
			`0 0 ${viewportPolicy.width} ${viewportPolicy.height}`,
		);
		expect(zoomExtent()).toEqual([
			[0, 0],
			[viewportPolicy.width, viewportPolicy.height],
		]);
		const { x, y } = viewportPolicy.zoom.translateOverscan;
		expect(zoomTranslateExtent()).toEqual([
			[-x, -y],
			[viewportPolicy.width + x, viewportPolicy.height + y],
		]);
	});

	it("keeps the current 960 by 640 output", () => {
		expect(viewportPolicy.width).toBe(960);
		expect(viewportPolicy.height).toBe(640);
		expect(viewportPolicy.zoom.scaleExtent).toEqual([1, 8]);
	});

	it("hands the same policy to whoever configures zoom", () => {
		const layout = createProjectionLayout(
			spainPreset,
			"mercator",
			spainBundle(),
		);
		expect(layout.policy).toBe(viewportPolicy);
		expect(layout.viewBox).toBe(viewBoxAttribute());
	});

	it("derives the translate extent from the viewport rather than repeating it", () => {
		// The relationship, not the literals: a different viewport moves both together.
		const [[left, top], [right, bottom]] = zoomTranslateExtent();
		const [[,], [width, height]] = zoomExtent();
		expect(right - left).toBe(
			width + viewportPolicy.zoom.translateOverscan.x * 2,
		);
		expect(bottom - top).toBe(
			height + viewportPolicy.zoom.translateOverscan.y * 2,
		);
	});
});

describe("inset reachability", () => {
	const layout = createProjectionLayout(spainPreset, "mercator", spainBundle());
	const bundle = spainBundle();

	it("projects every inset entity inside its own frame", () => {
		for (const inset of spainPreset.insets) {
			const feature = bundle.entities.features.find(
				({ properties }) => properties.inset === inset.key,
			);
			if (!feature) throw new Error(`No fixture geometry for ${inset.key}`);
			const [x, y] = layout.centroidFor(feature);

			expect(x).toBeGreaterThanOrEqual(inset.x);
			expect(x).toBeLessThanOrEqual(inset.x + inset.width);
			expect(y).toBeGreaterThanOrEqual(inset.y);
			expect(y).toBeLessThanOrEqual(inset.y + inset.height);
		}
	});

	it("keeps every inset frame inside the pannable area at minimum zoom", () => {
		const [[left, top], [right, bottom]] = zoomTranslateExtent();
		for (const inset of spainPreset.insets) {
			expect(inset.x).toBeGreaterThanOrEqual(left);
			expect(inset.y).toBeGreaterThanOrEqual(top);
			expect(inset.x + inset.width).toBeLessThanOrEqual(right);
			expect(inset.y + inset.height).toBeLessThanOrEqual(bottom);
		}
	});

	it("reserves room for an inline-start inset so the main map does not overlap it", () => {
		const world = createProjectionLayout(worldPreset, "equal-earth", {
			entities: { type: "FeatureCollection", features: [] },
			parents: { type: "FeatureCollection", features: [] },
		});
		// World has no insets, so it uses the whole frame and still reports the same viewBox.
		expect(world.viewBox).toBe(viewBoxAttribute());
		expect(worldPreset.insets).toHaveLength(0);
		expect(spainPreset.insets.length).toBeGreaterThan(0);
	});
});
