import { cleanSourceText } from "./source-text.mjs";

export function worldSourceKey(properties) {
	const iso = cleanSourceText(properties.ISO_A2_EH);
	return iso === "-99" ? `NE-${cleanSourceText(properties.ADM0_A3)}` : iso;
}

/** Every input feature must have an explicit destination, including non-primary land. */
export function matchWorldSource(manifest, features) {
	const entityByGeometry = new Map(
		manifest.entities.map((entity) => [entity.geometryId, entity]),
	);
	if (entityByGeometry.size !== manifest.entities.length)
		throw new Error("World manifest maps a source identity more than once.");
	const matches = new Map();
	const sourceIds = new Set();
	for (const feature of features) {
		const sourceId = cleanSourceText(feature.properties.ADM0_A3);
		if (!sourceId || sourceIds.has(sourceId))
			throw new Error(
				`Duplicate or missing World source identity ${sourceId}.`,
			);
		sourceIds.add(sourceId);
		const key = worldSourceKey(feature.properties);
		const entity = entityByGeometry.get(key);
		if (!entity)
			throw new Error(
				`Unaccounted World source feature ${cleanSourceText(feature.properties.ADMIN)} (${key}).`,
			);
		const group = matches.get(entity.id) ?? [];
		group.push(feature);
		matches.set(entity.id, group);
	}
	for (const entity of manifest.entities) {
		if (!matches.has(entity.id))
			throw new Error(`World geometry missing for ${entity.geometryId}.`);
	}
	return {
		matches,
		sourceCoverage: {
			sourceFeatures: features.length,
			primaryFeatures: manifest.entities
				.filter((e) => e.selectable)
				.reduce((total, e) => total + matches.get(e.id).length, 0),
			contextFeatures: manifest.entities
				.filter((e) => !e.selectable)
				.reduce((total, e) => total + matches.get(e.id).length, 0),
		},
	};
}
