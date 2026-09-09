import {
	type GeoProjection,
	geoEqualEarth,
	geoMercator,
	geoNaturalEarth1,
} from "d3-geo";
import { geoRobinson } from "d3-geo-projection";

import type { ProjectionId } from "@/features/atlas/domain";

/**
 * Everything a projection needs to exist, in one place.
 *
 * Its display label and its D3 factory used to live apart — a label table in the map component
 * and a switch in the layout code — so adding a projection meant synchronized edits in several
 * modules and forgetting one produced a silent fallback. The record is exhaustive over
 * `ProjectionId`, so a new ID that is missing either does not compile.
 */
export interface ProjectionDefinition {
	label: string;
	create: () => GeoProjection;
}

export const projectionRegistry: Record<ProjectionId, ProjectionDefinition> = {
	"equal-earth": { label: "Equal Earth", create: geoEqualEarth },
	"natural-earth": { label: "Natural Earth", create: geoNaturalEarth1 },
	robinson: { label: "Robinson", create: geoRobinson },
	mercator: { label: "Mercator", create: geoMercator },
};

export function projectionLabel(id: ProjectionId) {
	return projectionRegistry[id].label;
}

export function createProjection(id: ProjectionId) {
	return projectionRegistry[id].create();
}
