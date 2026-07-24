import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import * as shapefile from "shapefile";
import { feature as topologyFeature, mesh } from "topojson-client";
import { topology } from "topojson-server";
import {
	presimplify,
	quantile,
	simplify,
	sphericalTriangleArea,
} from "topojson-simplify";

import { manifests } from "./manifest-seeds.mjs";
import { validateManifest } from "./validate.mjs";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const publicMapDirectory = join(repositoryRoot, "apps/web/public/maps");
const manifestDirectory = join(
	repositoryRoot,
	"apps/web/src/features/atlas/presets/data",
);

const sources = {
	world: {
		filename: "world.zip",
		url: "https://naciscdn.org/naturalearth/50m/cultural/ne_50m_admin_0_countries.zip",
		sha256: "5fed433373581fa648920435f937d95f2d3c0200e067409c6478dcdf1b853139",
		version: "Natural Earth Admin 0 Countries 5.1.1, 1:50m",
		license: "Natural Earth public domain",
	},
	brazil: {
		filename: "brazil.zip",
		url: "https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_municipais/municipio_2024/Brasil/BR_UF_2024.zip",
		sha256: "be61a1e11bf86b265098b5a0b02eb836237421ad73354b1f0892fb6be4598866",
		version: "IBGE Malha Municipal Digital 2024 — Unidades da Federação",
		license: "Public IBGE geographic data; attribution required",
	},
	spain: {
		filename: "spain.zip",
		url: "https://centrodedescargas.cnig.es/CentroDescargas/descargaDir",
		requestBody: "secDescDirLA=9000029&secuencial=9000029",
		sha256: "d2c5ee140e7f48b3a5fc177b7c2bb05b757472e349290d0d0065d9c562f891da",
		version: "IGN/CNIG BDDAE provincial enclosures, published 2026-02-12",
		license: "Derived work of BDLJE CC-BY 4.0 ign.es",
	},
};

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
			`Checksum mismatch for ${source.filename}: expected ${source.sha256}, received ${checksum}`,
		);
	}
	return destination;
}

function cleanText(value) {
	return String(value ?? "")
		.replaceAll("\0", "")
		.trim();
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
	const byCode = new Map();
	for (const feature of source.features) {
		const code = cleanText(feature.properties.ISO_A2_EH);
		const matches = byCode.get(code) ?? [];
		matches.push(feature);
		byCode.set(code, matches);
	}
	return manifests.world.entities.map((entity) => {
		const matches = byCode.get(entity.geometryId);
		if (!matches)
			throw new Error(`World geometry missing for ${entity.geometryId}`);
		return featureForEntity(entity, matches);
	});
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
	return manifests.brazil.entities.map((entity) => {
		const matches = byCode.get(entity.geometryId);
		if (!matches)
			throw new Error(`Brazil geometry missing for ${entity.geometryId}`);
		return featureForEntity(entity, matches);
	});
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
			directory: "spain-canarias",
			entry:
				"SHP_REGCAN95/recintos_provinciales_inspire_canarias_regcan95/recintos_provinciales_inspire_canarias_regcan95",
			base: "recintos_provinciales_inspire_canarias_regcan95",
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
	return manifests.spain.entities.map((entity) => {
		const matches = byCode.get(entity.geometryId);
		if (!matches)
			throw new Error(`Spain geometry missing for ${entity.geometryId}`);
		return featureForEntity(entity, matches);
	});
}

const builders = { world: buildWorld, brazil: buildBrazil, spain: buildSpain };
const simplificationQuantiles = { world: 0.4, brazil: 0.04, spain: 0.03 };

async function buildPreset(id, zipPath, tempDirectory) {
	const manifest = manifests[id];
	const manifestErrors = validateManifest(manifest);
	if (manifestErrors.length > 0)
		throw new Error(`${id} manifest invalid:\n${manifestErrors.join("\n")}`);
	const entityFeatures = await builders[id](zipPath, tempDirectory);
	const parents = parentFeatures(manifest, entityFeatures);
	const sourceTopology = topology(
		{
			entities: { type: "FeatureCollection", features: entityFeatures },
			parents: { type: "FeatureCollection", features: parents },
		},
		100_000,
	);
	const weighted = presimplify(sourceTopology, sphericalTriangleArea);
	const simplificationQuantile = simplificationQuantiles[id];
	const threshold =
		simplificationQuantile === 0
			? 0
			: quantile(weighted, simplificationQuantile);
	const simplified = simplify(weighted, threshold);
	const renderable =
		id === "spain" ? repairSpainSimplification(simplified) : simplified;
	await writeFile(
		join(publicMapDirectory, `${id}.topo.json`),
		`${JSON.stringify(renderable)}\n`,
	);
	await writeFile(
		join(manifestDirectory, `${id}.manifest.json`),
		`${JSON.stringify(manifest, null, "\t")}\n`,
	);
	return {
		id,
		entities: entityFeatures.length,
		parents: parents.length,
		threshold,
	};
}

async function main() {
	await mkdir(publicMapDirectory, { recursive: true });
	await mkdir(manifestDirectory, { recursive: true });
	const tempDirectory = await mkdtemp(join(tmpdir(), "atlas-tint-geo-"));
	try {
		const results = [];
		for (const id of ["world", "brazil", "spain"]) {
			const zipPath = await obtainSource(sources[id], tempDirectory);
			results.push(await buildPreset(id, zipPath, tempDirectory));
		}
		const metadata = {
			pipelineVersion: 1,
			coordinateSystem: "WGS84-compatible geographic longitude/latitude",
			transformations: [
				"map source identifiers to application-owned stable IDs",
				"drop unused source properties",
				"combine multi-part entities",
				"extract external parent boundary meshes from shared child arcs",
				"quantize and simplify shared TopoJSON arcs conservatively",
				"remove simplified rings only when winding collapses into a globe-sized complement",
			],
			sources,
			results,
		};
		await writeFile(
			join(publicMapDirectory, "metadata.json"),
			`${JSON.stringify(metadata, null, "\t")}\n`,
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
