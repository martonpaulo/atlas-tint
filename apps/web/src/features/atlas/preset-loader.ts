import type {
	LoadedPreset,
	PresetId,
	PresetManifest,
} from "@/features/atlas/domain";
import {
	getPresetRegistration,
	presetCatalog,
} from "@/features/atlas/preset-catalog";

export async function loadPreset(id: PresetId): Promise<LoadedPreset> {
	const registration = getPresetRegistration(id);
	if (!registration) throw new Error(`Unknown map preset: ${id}`);
	return registration.load();
}

export async function loadAllManifests(): Promise<
	Record<string, PresetManifest>
> {
	const presets = await Promise.all(
		presetCatalog.map(({ id }) => loadPreset(id)),
	);
	return Object.fromEntries(
		presets.map(({ manifest }) => [manifest.id, manifest]),
	);
}
