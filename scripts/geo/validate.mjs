export function normalizeSearchText(value) {
	return value
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.toLocaleLowerCase("en")
		.replace(/[’'`´]/g, "")
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim()
		.replace(/\s+/g, " ");
}

export function validateManifest(manifest) {
	const errors = [];
	const ids = new Set();
	const geometryIds = new Set();
	const parentIds = new Set(manifest.parents.map(({ id }) => id));
	const searchTerms = new Map();

	for (const entity of manifest.entities) {
		if (ids.has(entity.id)) errors.push(`duplicate stable ID ${entity.id}`);
		if (geometryIds.has(entity.geometryId))
			errors.push(`duplicate geometry ID ${entity.geometryId}`);
		ids.add(entity.id);
		geometryIds.add(entity.geometryId);
		if (
			manifest.parents.length > 0 &&
			entity.groupId &&
			!parentIds.has(entity.groupId)
		) {
			errors.push(`unresolved parent ${entity.groupId} for ${entity.id}`);
		}

		const entityTerms = new Set([
			entity.name,
			...entity.localNames,
			...entity.aliases,
			...entity.codes,
		]);
		for (const term of entityTerms) {
			const normalized = normalizeSearchText(term);
			if (!normalized) continue;
			const previous = searchTerms.get(normalized);
			if (previous && previous !== entity.id) {
				errors.push(
					`ambiguous exact search term "${term}" for ${previous} and ${entity.id}`,
				);
			} else {
				searchTerms.set(normalized, entity.id);
			}
		}
	}

	for (const parent of manifest.parents) {
		if (parent.childIds.length === 0)
			errors.push(`parent ${parent.id} has no children`);
		for (const childId of parent.childIds) {
			if (!ids.has(childId))
				errors.push(`parent ${parent.id} references unknown child ${childId}`);
		}
	}

	const selectableTotal = manifest.entities.filter(
		({ selectable }) => selectable,
	).length;
	if (selectableTotal !== manifest.primaryTotal) {
		errors.push(
			`primary total ${manifest.primaryTotal} does not match ${selectableTotal} selectable entities`,
		);
	}

	return errors;
}
