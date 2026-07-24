import type { EntityManifest } from "@/features/atlas/domain";

export function normalizeSearchText(value: string) {
	return value
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.toLocaleLowerCase("en")
		.replace(/[’'`´]/g, "")
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim()
		.replace(/\s+/g, " ");
}

type SearchTier = 0 | 1 | 2 | 3 | 4;

interface RankedEntity {
	entity: EntityManifest;
	tier: SearchTier;
	fieldLength: number;
}

function rankEntity(
	entity: EntityManifest,
	query: string,
): RankedEntity | undefined {
	const canonical = normalizeSearchText(entity.name);
	const codes = entity.codes.map(normalizeSearchText);
	const aliases = [...entity.localNames, ...entity.aliases].map(
		normalizeSearchText,
	);
	const contextual = [entity.groupName, ...entity.groupAliases].map(
		normalizeSearchText,
	);
	if (canonical === query || codes.includes(query))
		return { entity, tier: 0, fieldLength: canonical.length };
	if (aliases.includes(query))
		return { entity, tier: 1, fieldLength: canonical.length };
	const fields = [canonical, ...codes, ...aliases, ...contextual];
	const prefix = fields.find((field) => field.startsWith(query));
	if (prefix) return { entity, tier: 2, fieldLength: prefix.length };
	const tokenPrefix = fields.find((field) =>
		field.split(" ").some((token) => token.startsWith(query)),
	);
	if (tokenPrefix) return { entity, tier: 3, fieldLength: tokenPrefix.length };
	const substring = fields.find((field) => field.includes(query));
	if (substring) return { entity, tier: 4, fieldLength: substring.length };
	return undefined;
}

export function searchEntities(
	entities: EntityManifest[],
	rawQuery: string,
	limit = 30,
) {
	const query = normalizeSearchText(rawQuery);
	if (!query) return entities.slice(0, limit);
	return entities
		.map((entity) => rankEntity(entity, query))
		.filter((result): result is RankedEntity => result !== undefined)
		.sort(
			(left, right) =>
				left.tier - right.tier ||
				left.fieldLength - right.fieldLength ||
				left.entity.name.localeCompare(right.entity.name, "en"),
		)
		.slice(0, limit)
		.map(({ entity }) => entity);
}
