import {
	type GeoPermissibleObjects,
	type GeoProjection,
	geoEqualEarth,
	geoMercator,
	geoNaturalEarth1,
	geoPath,
} from "d3-geo";
import { geoRobinson } from "d3-geo-projection";
import type { FeatureCollection, Geometry } from "geojson";

import type { LoadedPreset, ProjectionId } from "@/features/atlas/domain";
import type {
	EntityFeature,
	GeometryBundle,
	ParentFeature,
} from "@/features/atlas/geometry";

const VIEWBOX_WIDTH = 960;
const VIEWBOX_HEIGHT = 640;

function projectionFor(id: ProjectionId): GeoProjection {
	switch (id) {
		case "equal-earth":
			return geoEqualEarth();
		case "natural-earth":
			return geoNaturalEarth1();
		case "robinson":
			return geoRobinson();
		case "mercator":
			return geoMercator();
	}
}

function featureCollection<T extends EntityFeature | ParentFeature>(
	features: T[],
) {
	return { type: "FeatureCollection", features } as FeatureCollection<
		Geometry,
		T["properties"]
	>;
}

export interface ProjectionLayout {
	viewBox: `0 0 ${number} ${number}`;
	pathForEntity: (feature: EntityFeature) => string;
	pathForParent: (feature: ParentFeature) => string;
	centroidFor: (feature: EntityFeature) => [number, number];
}

export function createProjectionLayout(
	preset: LoadedPreset,
	projectionId: ProjectionId,
	bundle: GeometryBundle,
): ProjectionLayout {
	const insetKeys = new Set(preset.insets.map(({ key }) => key));
	const mainEntities = bundle.entities.features.filter(
		({ properties }) => !properties.inset || !insetKeys.has(properties.inset),
	);
	const mainProjection = projectionFor(projectionId);
	const reservedInlineStart = preset.insets.reduce(
		(maximum, inset) =>
			inset.x + inset.width < VIEWBOX_WIDTH / 2
				? Math.max(maximum, inset.x + inset.width + 24)
				: maximum,
		52,
	);
	if (preset.fit === "sphere") {
		mainProjection.fitExtent(
			[
				[24, 24],
				[VIEWBOX_WIDTH - 24, VIEWBOX_HEIGHT - 24],
			],
			{ type: "Sphere" },
		);
	} else {
		mainProjection.fitExtent(
			[
				[reservedInlineStart, 36],
				[VIEWBOX_WIDTH - 52, VIEWBOX_HEIGHT - 36],
			],
			featureCollection(mainEntities),
		);
	}
	const mainPath = geoPath(mainProjection);
	const insetPaths = new Map(
		preset.insets.flatMap((inset) => {
			const insetEntities = bundle.entities.features.filter(
				({ properties }) => properties.inset === inset.key,
			);
			if (insetEntities.length === 0) return [];
			const insetProjection = geoMercator().fitExtent(
				[
					[inset.x + inset.padding, inset.y + inset.padding + 16],
					[
						inset.x + inset.width - inset.padding,
						inset.y + inset.height - inset.padding,
					],
				],
				featureCollection(insetEntities),
			);
			return [[inset.key, geoPath(insetProjection)] as const];
		}),
	);
	const pathFor = (feature: EntityFeature | ParentFeature) => {
		const generator =
			(feature.properties.inset
				? insetPaths.get(feature.properties.inset)
				: undefined) ?? mainPath;
		return generator(feature as GeoPermissibleObjects) ?? "";
	};
	return {
		viewBox: `0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`,
		pathForEntity: pathFor,
		pathForParent: pathFor,
		centroidFor(feature) {
			const generator =
				(feature.properties.inset
					? insetPaths.get(feature.properties.inset)
					: undefined) ?? mainPath;
			return generator.centroid(feature as GeoPermissibleObjects);
		},
	};
}
