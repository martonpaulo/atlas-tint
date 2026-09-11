import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { feature as topologyFeature } from "topojson-client";
import { topologyPath } from "./artifacts.mjs";
import { sources } from "./sources.mjs";
import { validateWorldGeometry } from "./validate.mjs";
import { matchWorldSource } from "./world-source.mjs";

const manifest = {
	entities: [
		{ id: "denmark", geometryId: "DK", selectable: true },
		{ id: "greenland", geometryId: "GL", selectable: false },
	],
};
const feature = (iso, admin) => ({
	properties: { ISO_A2_EH: iso, ADM0_A3: admin, ADMIN: admin },
});
const features = () => [feature("DK\0", "DNK"), feature("GL\0", "GRL")];

test("accounts for primary and contextual source land after DBF normalization", () => {
	const result = matchWorldSource(manifest, features());
	assert.equal(result.matches.get("greenland").length, 1);
	assert.deepEqual(result.sourceCoverage, {
		sourceFeatures: 2,
		primaryFeatures: 1,
		contextFeatures: 1,
	});
});

test("rejects source land that no manifest entry owns", () => {
	assert.throws(
		() => matchWorldSource(manifest, [...features(), feature("XK", "KOS")]),
		/Unaccounted World source feature KOS/,
	);
});

test("rejects missing expected land and duplicate source identities", () => {
	assert.throws(
		() => matchWorldSource(manifest, features().slice(0, 1)),
		/missing for GL/,
	);
	assert.throws(
		() => matchWorldSource(manifest, [...features(), feature("DK", "DNK")]),
		/Duplicate or missing/,
	);
});

test("does not merge distinct territories sharing the upstream -99 placeholder", () => {
	const ids = ["SOL", "CYN", "KAS"];
	const result = matchWorldSource(
		{
			entities: ids.map((id) => ({
				id,
				geometryId: `NE-${id}`,
				selectable: false,
			})),
		},
		ids.map((id) => feature("-99", id)),
	);
	assert.equal(result.matches.size, 3);
	for (const id of ids)
		assert.equal(result.matches.get(id)[0].properties.ADM0_A3, id);
});

test("rejects a polygon collapsed by simplification", () => {
	const errors = validateWorldGeometry(
		[
			{
				properties: { id: "small-island" },
				geometry: {
					type: "Polygon",
					coordinates: [
						[
							[0, 0],
							[0, 0],
							[0, 0],
							[0, 0],
						],
					],
				},
			},
		],
		1,
	);
	assert.deepEqual(errors, [
		"small-island: World polygon lost its renderable area",
	]);
});

test("the shipped World preserves every source polygon with positive area", async () => {
	const topology = JSON.parse(await readFile(topologyPath("world"), "utf8"));
	const collection = topologyFeature(topology, topology.objects.entities);
	assert.deepEqual(
		validateWorldGeometry(collection.features, sources.world.polygonCount),
		[],
	);
});
