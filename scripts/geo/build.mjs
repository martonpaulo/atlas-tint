import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as shapefile from "shapefile";
import { mesh, feature as topologyFeature } from "topojson-client";
import { topology } from "topojson-server";
import {
	presimplify,
	quantile,
	simplify,
	sphericalTriangleArea,
} from "topojson-simplify";
import {
	digest,
	geometryVersionsPath,
	manifestDirectory,
	manifestPath,
	metadataPath,
	presetIds,
	publicMapDirectory,
	serializeGeometryVersions,
	serializeManifest,
	serializeMetadata,
	serializeTopology,
	topologyPath,
} from "./artifacts.mjs";
import { manifests } from "./manifest-seeds.mjs";
import { cleanSourceText as cleanText } from "./source-text.mjs";
import { sources } from "./sources.mjs";
import { validateManifest } from "./validate.mjs";
import { matchWorldSource } from "./world-source.mjs";

function run(command, commandArguments) {
	const result = spawnSync(command, commandArguments, { encoding: "utf8" });
	if (result.status !== 0) {
		throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
	}
}

async function sha256(path) {
	const contents = await readFile(path);
	return createHash("sha256").update(contents).digest("hex");
}

/**
 * A checksum mismatch has two very different causes, and the fix differs completely, so say
 * which one happened: a download that is not even an archive is a transport problem to retry,
 * while a well-formed archive means the upstream republished and the new publication needs a
 * reviewed boundary diff before its checksum is adopted.
 */
async function describeChecksumMismatch(path, source, checksum) {
	const header = (await readFile(path)).subarray(0, 4);
	const isZip = header.equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
	const cause = isZip
		? "the archive is a well-formed zip, so the upstream has most likely republished; review the new publication's boundary diff before adopting its checksum"
		: "the response is not a zip archive, so the download was truncated or the endpoint returned an error page; retry before touching the pin";
	return [
		`Checksum mismatch for ${source.filename}: expected ${source.sha256}, received ${checksum}.`,
		`Source: ${source.version}.`,
		cause,
	].join("\n");
}

async function obtainSource(source, tempDirectory) {
	const configuredCache = process.env.ATLAS_GEO_CACHE_DIR;
	const destination = join(tempDirectory, source.filename);
	const cachedPath = configuredCache
		? join(configuredCache, source.filename)
		: undefined;
	if (
		cachedPath &&
		(await sha256(cachedPath).catch(() => "")) === source.sha256
	) {
		await writeFile(destination, await readFile(cachedPath));
		return destination;
	}

	const response = await fetch(source.url, {
		method: source.requestBody ? "POST" : "GET",
		headers: source.requestBody
			? { "content-type": "application/x-www-form-urlencoded" }
			: undefined,
		body: source.requestBody,
	});
	if (!response.ok)
		throw new Error(`Download failed (${response.status}) for ${source.url}`);
	await writeFile(destination, Buffer.from(await response.arrayBuffer()));
	const checksum = await sha256(destination);
	if (checksum !== source.sha256) {
		throw new Error(
			await describeChecksumMismatch(destination, source, checksum),
		);
	}
	// Seed the documented offline cache, so a source whose endpoint only ever serves its latest
	// publication stays rebuildable from the exact bytes this build verified.
	if (cachedPath) {
		await mkdir(configuredCache, { recursive: true });
		await writeFile(cachedPath, await readFile(destination));
	}
	return destination;
}

function combineGeometries(features) {
	const coordinates = [];
	for (const feature of features) {
		if (feature.geometry.type === "Polygon")
			coordinates.push(feature.geometry.coordinates);
		if (feature.geometry.type === "MultiPolygon")
			coordinates.push(...feature.geometry.coordinates);
	}
	if (coordinates.length === 0)
		throw new Error("Cannot combine an empty geometry set");
	return { type: "MultiPolygon", coordinates };
}

function signedRingArea(ring) {
	let area = 0;
	for (let index = 0; index < ring.length - 1; index += 1) {
		const point = ring[index];
		const next = ring[index + 1];
		area += point[0] * next[1] - next[0] * point[1];
	}
	return area / 2;
}

function removeInvertedExteriorRings(geometry) {
	if (!geometry) return null;
	if (geometry.type === "Polygon")
		return signedRingArea(geometry.coordinates[0]) < 0 ? geometry : null;
	if (geometry.type !== "MultiPolygon") return geometry;
	const coordinates = geometry.coordinates.filter(
		(polygon) => signedRingArea(polygon[0]) < 0,
	);
	return coordinates.length > 0 ? { type: "MultiPolygon", coordinates } : null;
}

function repairSpainSimplification(topologyValue) {
	const collections = Object.fromEntries(
		Object.entries(topologyValue.objects).map(([name, object]) => {
			const collection = topologyFeature(topologyValue, object);
			if (collection.type !== "FeatureCollection")
				throw new Error(`Expected ${name} to be a feature collection`);
			return [
				name,
				{
					type: "FeatureCollection",
					features: collection.features
						.map((feature) => ({
							...feature,
							geometry: removeInvertedExteriorRings(feature.geometry),
						}))
						.filter((feature) => feature.geometry),
				},
			];
		}),
	);
	return topology(collections, 100_000);
}

function featureForEntity(entity, sourceFeatures) {
	return {
		type: "Feature",
		properties: {
			id: entity.id,
			geometryId: entity.geometryId,
			groupId: entity.groupId,
			inset: entity.inset ?? null,
		},
		geometry: combineGeometries(sourceFeatures),
	};
}

function parentFeatures(manifest, entityFeatures) {
	const entityTopology = topology(
		{ entities: { type: "FeatureCollection", features: entityFeatures } },
		100_000,
	);
	const entityObject = entityTopology.objects.entities;
	if (entityObject.type !== "GeometryCollection")
		throw new Error("Entity topology did not produce a geometry collection");
	const topologyGeometryById = new Map(
		entityObject.geometries.map((geometry) => [
			geometry.properties.id,
			geometry,
		]),
	);
	const featureById = new Map(
		entityFeatures.map((feature) => [feature.properties.id, feature]),
	);
	return manifest.parents.map((parent) => {
		const childIds = new Set(parent.childIds);
		const children = parent.childIds
			.map((id) => featureById.get(id))
			.filter(Boolean);
		if (
			parent.childIds.some((id) => !topologyGeometryById.has(id)) ||
			children.length !== parent.childIds.length
		)
			throw new Error(`Parent geometry missing children for ${parent.id}`);
		const insetNames = new Set(
			children.map((feature) => feature.properties.inset).filter(Boolean),
		);
		return {
			type: "Feature",
			properties: {
				id: parent.id,
				inset:
					insetNames.size === 1 &&
					children.every((feature) => feature.properties.inset)
						? [...insetNames][0]
						: null,
			},
			geometry: mesh(entityTopology, entityObject, (first, second) => {
				const firstBelongs = childIds.has(first.properties.id);
				const secondBelongs = childIds.has(second.properties.id);
				return first === second ? firstBelongs : firstBelongs !== secondBelongs;
			}),
		};
	});
}

async function readShape(directory, baseName) {
	return shapefile.read(
		join(directory, `${baseName}.shp`),
		join(directory, `${baseName}.dbf`),
	);
}

async function buildWorld(zipPath, tempDirectory) {
	const shapeDirectory = join(tempDirectory, "world");
	await mkdir(shapeDirectory);
	run("unzip", [
		"-q",
		"-j",
		zipPath,
		"ne_50m_admin_0_countries.shp",
		"ne_50m_admin_0_countries.dbf",
		"-d",
		shapeDirectory,
	]);
	const source = await readShape(shapeDirectory, "ne_50m_admin_0_countries");
	if (source.features.length !== sources.world.featureCount)
		throw new Error(
			"World source feature count differs from the pinned source contract.",
		);
	const { matches, sourceCoverage } = matchWorldSource(
		manifests.world,
		source.features,
	);
	return {
		entities: manifests.world.entities.map((entity) =>
			featureForEntity(entity, matches.get(entity.id)),
		),
		sourceCoverage,
	};
}

async function buildBrazil(zipPath, tempDirectory) {
	const shapeDirectory = join(tempDirectory, "brazil");
	await mkdir(shapeDirectory);
	run("unzip", [
		"-q",
		"-j",
		zipPath,
		"BR_UF_2024.shp",
		"BR_UF_2024.dbf",
		"-d",
		shapeDirectory,
	]);
	const source = await readShape(shapeDirectory, "BR_UF_2024");
	const byCode = new Map(
		source.features.map((feature) => [
			cleanText(feature.properties.SIGLA_UF),
			[feature],
		]),
	);
	return {
		entities: manifests.brazil.entities.map((entity) => {
			const matches = byCode.get(entity.geometryId);
			if (!matches)
				throw new Error(`Brazil geometry missing for ${entity.geometryId}`);
			return featureForEntity(entity, matches);
		}),
	};
}

async function buildSpain(zipPath, tempDirectory) {
	const inputs = [
		{
			directory: "spain-etrs",
			entry:
				"SHP_ETRS89/recintos_provinciales_inspire_peninbal_etrs89/recintos_provinciales_inspire_peninbal_etrs89",
			base: "recintos_provinciales_inspire_peninbal_etrs89",
		},
		{
			// The 2026-07-28 publication ships the Canary enclosures as WGS84 instead of the
			// earlier REGCAN95 folder. Both are geographic longitude/latitude on the same
			// datum realisation, so the coordinates are used as-is.
			directory: "spain-canarias",
			entry:
				"SHP_WGS84/recintos_provinciales_inspire_canarias_wgs84/recintos_provinciales_inspire_canarias_wgs84",
			base: "recintos_provinciales_inspire_canarias_wgs84",
		},
	];
	const byCode = new Map();
	for (const input of inputs) {
		const shapeDirectory = join(tempDirectory, input.directory);
		await mkdir(shapeDirectory);
		run("unzip", [
			"-q",
			"-j",
			zipPath,
			`${input.entry}.shp`,
			`${input.entry}.dbf`,
			"-d",
			shapeDirectory,
		]);
		const source = await readShape(shapeDirectory, input.base);
		for (const feature of source.features) {
			const nationalCode = cleanText(feature.properties.NATCODE);
			const code = nationalCode.slice(4, 6);
			if (!/^\d{2}$/.test(code)) continue;
			const matches = byCode.get(code) ?? [];
			matches.push(feature);
			byCode.set(code, matches);
		}
	}
	return {
		entities: manifests.spain.entities.map((entity) => {
			const matches = byCode.get(entity.geometryId);
			if (!matches)
				throw new Error(`Spain geometry missing for ${entity.geometryId}`);
			return featureForEntity(entity, matches);
		}),
	};
}

const builders = { world: buildWorld, brazil: buildBrazil, spain: buildSpain };
const simplificationQuantiles = { world: 0, brazil: 0.04, spain: 0.03 };

async function buildPreset(id, zipPath, tempDirectory) {
	const manifest = manifests[id];
	const manifestErrors = validateManifest(manifest);
	if (manifestErrors.length > 0)
		throw new Error(`${id} manifest invalid:\n${manifestErrors.join("\n")}`);
	const { entities: entityFeatures, sourceCoverage } = await builders[id](
		zipPath,
		tempDirectory,
	);
	const parents = parentFeatures(manifest, entityFeatures);
	const sourceTopology = topology(
		{
			entities: { type: "FeatureCollection", features: entityFeatures },
			parents: { type: "FeatureCollection", features: parents },
		},
		100_000,
	);
	const simplificationQuantile = simplificationQuantiles[id];
	const weighted =
		simplificationQuantile === 0
			? undefined
			: presimplify(sourceTopology, sphericalTriangleArea);
	const threshold = weighted ? quantile(weighted, simplificationQuantile) : 0;
	const simplified = weighted ? simplify(weighted, threshold) : sourceTopology;
	const renderable =
		id === "spain" ? repairSpainSimplification(simplified) : simplified;
	const topologyBytes = serializeTopology(renderable);
	const manifestBytes = serializeManifest(manifest);
	await writeFile(topologyPath(id), topologyBytes);
	await writeFile(manifestPath(id), manifestBytes);
	return {
		id,
		entities: entityFeatures.length,
		parents: parents.length,
		threshold,
		...(sourceCoverage ? { sourceCoverage } : {}),
		// Fingerprints tie the recorded metadata to the exact artifacts this run emitted, so a
		// stale manifest or topology cannot pass as belonging to the recorded generation.
		manifestSha256: digest(manifestBytes),
		topologySha256: digest(topologyBytes),
	};
}

async function main() {
	await mkdir(publicMapDirectory, { recursive: true });
	await mkdir(manifestDirectory, { recursive: true });
	const tempDirectory = await mkdtemp(join(tmpdir(), "atlas-tint-geo-"));
	try {
		const results = [];
		for (const id of presetIds) {
			const zipPath = await obtainSource(sources[id], tempDirectory);
			results.push(await buildPreset(id, zipPath, tempDirectory));
		}
		const metadata = {
			pipelineVersion: 2,
			coordinateSystem: "WGS84-compatible geographic longitude/latitude",
			transformations: [
				"map source identifiers to application-owned stable IDs",
				"drop unused source properties",
				"combine multi-part entities",
				"preserve all World 1:50m polygons without additional simplification",
				"extract external parent boundary meshes from shared child arcs",
				"quantize and simplify shared TopoJSON arcs conservatively",
				"remove simplified rings only when winding collapses into a globe-sized complement",
			],
			sources,
			results,
		};
		await writeFile(metadataPath, serializeMetadata(metadata));
		// The browser requests geometry by content, so a new application bundle can never reuse a
		// topology cached from a different build.
		await writeFile(
			geometryVersionsPath,
			serializeGeometryVersions(
				Object.fromEntries(
					results.map(({ id, topologySha256 }) => [id, topologySha256]),
				),
			),
		);
		for (const result of results)
			console.log(
				`${result.id}: ${result.entities} entities, ${result.parents} parents`,
			);
	} finally {
		await rm(tempDirectory, { recursive: true, force: true });
	}
}

await main();
