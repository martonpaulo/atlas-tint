import type {
	LoadedPreset,
	PresetId,
	ProjectionId,
} from "@/features/atlas/domain";

export interface PresetRegistration {
	id: PresetId;
	label: string;
	defaultProjection: ProjectionId;
	load: () => Promise<LoadedPreset>;
}

export const presetCatalog = [
	{
		id: "world",
		label: "World",
		defaultProjection: "equal-earth",
		load: async () =>
			(await import("@/features/atlas/presets/world")).worldPreset,
	},
	{
		id: "brazil",
		label: "Brazil",
		defaultProjection: "mercator",
		load: async () =>
			(await import("@/features/atlas/presets/brazil")).brazilPreset,
	},
	{
		id: "spain",
		label: "Spain",
		defaultProjection: "mercator",
		load: async () =>
			(await import("@/features/atlas/presets/spain")).spainPreset,
	},
] as const satisfies ReadonlyArray<PresetRegistration>;

export const defaultPresetId: PresetId = presetCatalog[0].id;

const registrations = new Map<PresetId, PresetRegistration>(
	presetCatalog.map((preset) => [preset.id, preset]),
);

export function isAvailablePresetId(value: string): value is PresetId {
	return registrations.has(value);
}

export function getPresetRegistration(id: PresetId) {
	return registrations.get(id);
}
