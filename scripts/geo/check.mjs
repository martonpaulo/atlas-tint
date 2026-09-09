import { readFile } from "node:fs/promises";

import { geoArea } from "d3-geo";
import { feature as topologyFeature } from "topojson-client";

import {
	digest,
	geometryVersionsPath,
	manifestPath,
	metadataPath,
	presetIds,
	serializeManifest,
	topologyPath,
} from "./artifacts.mjs";
import { manifests } from "./manifest-seeds.mjs";
import { sources } from "./sources.mjs";
import { validateManifest } from "./validate.mjs";

const errors = [];

async function readText(path, label) {
	try {
		return await readFile(path, "utf8");
	} catch (error) {
		errors.push(
			`cannot read ${label} (${error instanceof Error ? error.message : "unknown error"})`,
		);
		return undefined;
	}
}

/**
 * Report *what* drifted rather than "the files differ". A stale alias and a changed stable ID
 * are both a byte difference, but only one of them is a geographic identity incident.
 */
function describeDrift(expected, actual, path = "", found = []) {
	if (found.length >= 5) return found;
	if (expected === actual) return found;
	const bothObjects =
		typeof expected === "object" &&
		expected !== null &&
		typeof actual === "object" &&
		actual !== null &&
		Array.isArray(expected) === Array.isArray(actual);
	if (!bothObjects) {
		found.push(
			`${path || "manifest"}: expected ${JSON.stringify(expected)}, committed ${JSON.stringify(actual)}`,
		);
		return found;
	}
	const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
	for (const key of keys) {
		if (found.length >= 5) break;
		const childPath = path ? `${path}.${key}` : key;
		if (!(key in expected)) {
			found.push(`${childPath}: present in the committed artifact only`);
		} else if (!(key in actual)) {
			found.push(`${childPath}: missing from the committed artifact`);
		} else {
			describeDrift(expected[key], actual[key], childPath, found);
		}
	}
	return found;
}

async function checkPreset(id) {
	const seed = manifests[id];
	// The browser loads the committed manifest JSON, never the build seed, so every semantic
	// check below runs against the committed artifact.
	const committedManifestText = await readText(
		manifestPath(id),
		`${id} runtime manifest`,
	);
	if (committedManifestText === undefined) return;

	const expectedManifestText = serializeManifest(seed);
	let runtimeManifest;
	try {
		runtimeManifest = JSON.parse(committedManifestText);
	} catch (error) {
		errors.push(
			`${id}: runtime manifest is not valid JSON (${error instanceof Error ? error.message : "unknown error"})`,
		);
		return;
	}

	if (committedManifestText !== expectedManifestText) {
		// Compare the JSON-visible shape of both sides: the seed object carries `undefined`
		// optional keys that encoding drops, and those are not drift.
		const drift = describeDrift(
			JSON.parse(expectedManifestText),
			runtimeManifest,
		);
		errors.push(
			`${id}: the committed runtime manifest does not match the canonical seed. ${
				drift.length > 0
					? drift.join("; ")
					: "the values agree but the encoding differs; regenerate with pnpm geo:build"
			}`,
		);
	}

	errors.push(
		...validateManifest(runtimeManifest).map((error) => `${id}: ${error}`),
	);

	const topologyText = await readText(topologyPath(id), `${id} topology`);
	if (topologyText === undefined) return;
	let topology;
	try {
		topology = JSON.parse(topologyText);
	} catch (error) {
		errors.push(
			`${id}: topology is not valid JSON (${error instanceof Error ? error.message : "unknown error"})`,
		);
		return;
	}

	const geometries = topology.objects?.entities?.geometries;
	if (!Array.isArray(geometries)) {
		errors.push(`${id}: topology has no entities geometry collection`);
		return;
	}
	const geometryById = new Map(
		geometries.map((geometry) => [
			geometry.properties?.id,
			geometry.properties,
		]),
	);
	for (const entity of runtimeManifest.entities) {
		const properties = geometryById.get(entity.id);
		if (!properties) {
			errors.push(`${id}: missing generated geometry for ${entity.id}`);
			continue;
		}
		if (properties.geometryId !== entity.geometryId) {
			errors.push(
				`${id}: ${entity.id} maps to source geometry ${properties.geometryId}, manifest declares ${entity.geometryId}`,
			);
		}
		if (properties.groupId !== entity.groupId) {
			errors.push(
				`${id}: ${entity.id} carries group ${properties.groupId}, manifest declares ${entity.groupId}`,
			);
		}
	}
	for (const geometryId of geometryById.keys()) {
		if (
			!runtimeManifest.entities.some(
				({ id: entityId }) => entityId === geometryId,
			)
		) {
			errors.push(`${id}: unexpected selectable geometry ${geometryId}`);
		}
	}

	const entityFeatures = topologyFeature(topology, topology.objects.entities);
	if (entityFeatures.type !== "FeatureCollection") {
		errors.push(`${id}: entities did not decode to a feature collection`);
		return;
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
		return;
	}
	const parentGeometryIds = new Set(
		parentGeometries.map((geometry) => geometry.properties?.id),
	);
	for (const parent of runtimeManifest.parents) {
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

	return {
		manifestSha256: digest(committedManifestText),
		topologySha256: digest(topologyText),
	};
}

async function checkGeneration(fingerprints) {
	const metadataText = await readText(metadataPath, "generated map metadata");
	const versionsText = await readText(
		geometryVersionsPath,
		"generated geometry versions",
	);
	if (metadataText === undefined || versionsText === undefined) return;

	let metadata;
	let versions;
	try {
		metadata = JSON.parse(metadataText);
		versions = JSON.parse(versionsText);
	} catch (error) {
		errors.push(
			`generated metadata is not valid JSON (${error instanceof Error ? error.message : "unknown error"})`,
		);
		return;
	}

	if (JSON.stringify(metadata.sources) !== JSON.stringify(sources)) {
		errors.push(
			"generated metadata records different sources than the pipeline declares; regenerate with pnpm geo:build",
		);
	}

	const results = new Map(
		(metadata.results ?? []).map((result) => [result.id, result]),
	);
	for (const [id, actual] of fingerprints) {
		const recorded = results.get(id);
		if (!recorded) {
			errors.push(`${id}: generated metadata records no build result`);
			continue;
		}
		if (recorded.manifestSha256 !== actual.manifestSha256) {
			errors.push(
				`${id}: the committed manifest belongs to a different generation than the recorded metadata`,
			);
		}
		if (recorded.topologySha256 !== actual.topologySha256) {
			errors.push(
				`${id}: the committed topology belongs to a different generation than the recorded metadata`,
			);
		}
		if (versions[id] !== actual.topologySha256) {
			errors.push(
				`${id}: the geometry version the browser requests does not identify the committed topology`,
			);
		}
	}
	for (const id of Object.keys(versions)) {
		if (!fingerprints.has(id))
			errors.push(`geometry versions record unknown preset ${id}`);
	}
}

const fingerprints = new Map();
for (const id of presetIds) {
	const fingerprint = await checkPreset(id);
	if (fingerprint) fingerprints.set(id, fingerprint);
}
await checkGeneration(fingerprints);

if (errors.length > 0) {
	console.error(errors.join("\n"));
	process.exitCode = 1;
} else {
	const totals = presetIds
		.map((id) => `${id} ${manifests[id].primaryTotal}`)
		.join(", ");
	console.log(
		`Geographic invariants passed for the shipped artifacts: ${totals}.`,
	);
}
