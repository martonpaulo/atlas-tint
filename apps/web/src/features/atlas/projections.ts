import { type GeoPermissibleObjects, geoMercator, geoPath } from "d3-geo";
import type { FeatureCollection, Geometry } from "geojson";

import type { LoadedPreset, ProjectionId } from "@/features/atlas/domain";
import type {
	EntityFeature,
	GeometryBundle,
	ParentFeature,
} from "@/features/atlas/geometry";
import { createProjection } from "@/features/atlas/projection-registry";

/**
 * One immutable description of the map viewport.
 *
 * Projection fitting owned 960 × 640 privately and exposed only a formatted `viewBox` string,
 * while the zoom setup repeated the same numbers and derived its translation bounds from further
 * literals. Changing the layout could desynchronize the two with nothing to catch it — no type
 * error, no failing test. Both now read these numbers.
 */
export const viewportPolicy = {
	width: 960,
	height: 640,
	/** Breathing room when fitting the whole sphere. */
	spherePadding: 24,
	/** Asymmetric because the projection selector and zoom controls sit inline-end. */
	entityPadding: { top: 36, bottom: 36, inlineStart: 52, inlineEnd: 52 },
	/** How far a projected inset sits from its frame. */
	insetLabelClearance: 16,
	zoom: {
		scaleExtent: [1, 8],
		/**
		 * Overscan, so a region at the very edge — a Canary inset, Ceuta — can still be brought
		 * to the middle of the frame rather than being pinned against it.
		 */
		translateOverscan: { x: 120, y: 80 },
	},
} as const;

export type ViewportPolicy = typeof viewportPolicy;

const VIEWBOX_WIDTH = viewportPolicy.width;
const VIEWBOX_HEIGHT = viewportPolicy.height;

/** The `[[x0, y0], [x1, y1]]` pair D3 zoom calls its extent: the visible viewport. */
export function zoomExtent(): [[number, number], [number, number]] {
	return [
		[0, 0],
		[viewportPolicy.width, viewportPolicy.height],
	];
}

/** How far the content may be panned, derived from the viewport rather than repeated. */
export function zoomTranslateExtent(): [[number, number], [number, number]] {
	const { x, y } = viewportPolicy.zoom.translateOverscan;
	return [
		[-x, -y],
		[viewportPolicy.width + x, viewportPolicy.height + y],
	];
}

export function viewBoxAttribute() {
	return `0 0 ${viewportPolicy.width} ${viewportPolicy.height}` as const;
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
	/** The same numbers the fitting used, so zoom cannot be configured from different ones. */
	policy: ViewportPolicy;
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
	const mainProjection = createProjection(projectionId);
	const { entityPadding, spherePadding, insetLabelClearance } = viewportPolicy;
	// An inset frame on the inline-start half pushes the main map aside so they do not overlap.
	const reservedInlineStart = preset.insets.reduce<number>(
		(maximum, inset) =>
			inset.x + inset.width < VIEWBOX_WIDTH / 2
				? Math.max(maximum, inset.x + inset.width + spherePadding)
				: maximum,
		entityPadding.inlineStart,
	);
	if (preset.fit === "sphere") {
		mainProjection.fitExtent(
			[
				[spherePadding, spherePadding],
				[VIEWBOX_WIDTH - spherePadding, VIEWBOX_HEIGHT - spherePadding],
			],
			{ type: "Sphere" },
		);
	} else {
		mainProjection.fitExtent(
			[
				[reservedInlineStart, entityPadding.top],
				[
					VIEWBOX_WIDTH - entityPadding.inlineEnd,
					VIEWBOX_HEIGHT - entityPadding.bottom,
				],
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
					[
						inset.x + inset.padding,
						inset.y + inset.padding + insetLabelClearance,
					],
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
		viewBox: viewBoxAttribute(),
		policy: viewportPolicy,
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
