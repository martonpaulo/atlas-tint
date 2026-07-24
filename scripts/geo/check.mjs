import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { geoArea } from "d3-geo";
import { feature as topologyFeature } from "topojson-client";

import { manifests } from "./manifest-seeds.mjs";
import { validateManifest } from "./validate.mjs";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const errors = [];

for (const id of ["world", "brazil", "spain"]) {
	const manifest = manifests[id];
	errors.push(...validateManifest(manifest).map((error) => `${id}: ${error}`));
	const topologyPath = resolve(
		repositoryRoot,
		`apps/web/public/maps/${id}.topo.json`,
	);
	let topology;
	try {
		topology = JSON.parse(await readFile(topologyPath, "utf8"));
	} catch (error) {
		errors.push(
			`${id}: cannot read generated topology (${error instanceof Error ? error.message : "unknown error"})`,
		);
		continue;
	}
	const geometries = topology.objects?.entities?.geometries;
	if (!Array.isArray(geometries)) {
		errors.push(`${id}: topology has no entities geometry collection`);
		continue;
	}
	const geometryIds = new Set(
		geometries.map((geometry) => geometry.properties?.id),
	);
	for (const entity of manifest.entities) {
		if (!geometryIds.has(entity.id))
			errors.push(`${id}: missing generated geometry for ${entity.id}`);
	}
	for (const geometryId of geometryIds) {
		if (
			!manifest.entities.some(({ id: entityId }) => entityId === geometryId)
		) {
			errors.push(`${id}: unexpected selectable geometry ${geometryId}`);
		}
	}
	const entityFeatures = topologyFeature(topology, topology.objects.entities);
	if (entityFeatures.type !== "FeatureCollection") {
		errors.push(`${id}: entities did not decode to a feature collection`);
		continue;
	}
	for (const entityFeature of entityFeatures.features) {
		const area = geoArea(entityFeature);
		if (!Number.isFinite(area) || area >= Math.PI * 2) {
			errors.push(
				`${id}: ${entityFeature.properties?.id ?? "unknown entity"} has invalid spherical winding`,
			);
		}
	}
	const parentGeometries = topology.objects?.parents?.geometries;
	if (!Array.isArray(parentGeometries)) {
		errors.push(`${id}: topology has no parent geometry collection`);
		continue;
	}
	const parentGeometryIds = new Set(
		parentGeometries.map((geometry) => geometry.properties?.id),
	);
	for (const parent of manifest.parents) {
		if (!parentGeometryIds.has(parent.id))
			errors.push(`${id}: missing generated parent boundary for ${parent.id}`);
	}
	for (const geometry of parentGeometries) {
		if (geometry.type !== "MultiLineString") {
			errors.push(
				`${id}: ${geometry.properties?.id ?? "unknown parent"} must be a boundary mesh, received ${geometry.type}`,
			);
		}
	}
}

if (errors.length > 0) {
	console.error(errors.join("\n"));
	process.exitCode = 1;
} else {
	console.log("Geographic invariants passed: world 195, Brazil 27, Spain 52.");
}
