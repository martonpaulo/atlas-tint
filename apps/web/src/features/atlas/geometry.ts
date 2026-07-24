import type { Feature, FeatureCollection, Geometry } from "geojson";
import { feature as topologyFeature } from "topojson-client";
import type {
	GeometryCollection,
	GeometryObject,
	Topology,
} from "topojson-specification";

export interface EntityGeometryProperties {
	[key: string]: string | null;
	id: string;
	geometryId: string;
	groupId: string;
	inset: string | null;
}

export interface ParentGeometryProperties {
	[key: string]: string | null;
	id: string;
	inset: string | null;
}

type AtlasGeometryProperties =
	| EntityGeometryProperties
	| ParentGeometryProperties;

type AtlasTopologyObjects = Record<
	string,
	GeometryObject<AtlasGeometryProperties>
> & {
	entities: GeometryCollection<EntityGeometryProperties>;
	parents: GeometryCollection<ParentGeometryProperties>;
};

type AtlasTopology = Topology<AtlasTopologyObjects>;

export interface GeometryBundle {
	entities: FeatureCollection<Geometry, EntityGeometryProperties>;
	parents: FeatureCollection<Geometry, ParentGeometryProperties>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function hasGeometryCollection(value: unknown, propertyNames: string[]) {
	if (
		!isRecord(value) ||
		value.type !== "GeometryCollection" ||
		!Array.isArray(value.geometries)
	)
		return false;
	return value.geometries.every((geometry) => {
		if (!isRecord(geometry)) return false;
		const properties = geometry.properties;
		if (!isRecord(properties)) return false;
		return propertyNames.every(
			(property) => typeof properties[property] === "string",
		);
	});
}

function isAtlasTopology(value: unknown): value is AtlasTopology {
	return (
		isRecord(value) &&
		value.type === "Topology" &&
		Array.isArray(value.arcs) &&
		isRecord(value.objects) &&
		hasGeometryCollection(value.objects.entities, [
			"id",
			"geometryId",
			"groupId",
		]) &&
		hasGeometryCollection(value.objects.parents, ["id"])
	);
}

export function parseGeometryTopology(value: unknown): GeometryBundle {
	if (!isAtlasTopology(value))
		throw new Error(
			"The map asset is missing its expected geometry collections.",
		);
	return {
		entities: topologyFeature(value, value.objects.entities),
		parents: topologyFeature(value, value.objects.parents),
	};
}

export async function loadGeometry(url: string, signal?: AbortSignal) {
	const response = await fetch(url, { signal });
	if (!response.ok)
		throw new Error(`Map asset request failed with status ${response.status}.`);
	const value: unknown = await response.json();
	return parseGeometryTopology(value);
}

export function findEntityFeature(bundle: GeometryBundle, entityId: string) {
	return bundle.entities.features.find(
		({ properties }) => properties.id === entityId,
	);
}

export type EntityFeature = Feature<Geometry, EntityGeometryProperties>;
export type ParentFeature = Feature<Geometry, ParentGeometryProperties>;
