import {
	type EntityManifest,
	type LoadedPreset,
	type PresetManifest,
	presetManifestSchema,
} from "@/features/atlas/domain";

export function entity(
	id: string,
	selectable: boolean,
	groupId = "group-a",
): EntityManifest {
	return {
		id,
		geometryId: id,
		name: id.toUpperCase(),
		localNames: [],
		aliases: [],
		codes: [id.slice(-2).toUpperCase()],
		groupId,
		groupName: "Group A",
		groupAliases: [],
		selectable,
	};
}

/**
 * A preset that renders a non-selectable territory for map continuity.
 *
 * The three shipped manifests are all-selectable, so nothing in them exercises the selectability
 * contract. This fixture does, without touching the political inclusion policy of a real preset.
 */
export const mixedManifest: PresetManifest = presetManifestSchema.parse({
	id: "mixed",
	name: "Mixed selectability",
	shortName: "Mixed",
	description: "Two selectable states and one visible territory.",
	primaryTotal: 2,
	defaultProjection: "mercator",
	projections: ["mercator"],
	entities: [
		entity("mx-a", true),
		entity("mx-b", true),
		entity("mx-territory", false),
	],
	parents: [
		{
			id: "group-a",
			name: "Group A",
			aliases: [],
			childIds: ["mx-a", "mx-b", "mx-territory"],
		},
	],
});

/** The same fixture as a loaded preset, for anything that renders rather than validates. */
export const mixedPreset: LoadedPreset = {
	manifest: mixedManifest,
	geometryUrl: "maps/mixed.topo.json",
	attribution: "Synthetic fixture",
	groupHues: { "group-a": 300 },
	fit: "entities",
	insets: [],
};
