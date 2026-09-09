import type {
	LoadedPreset,
	PresetId,
	PresetManifest,
} from "@/features/atlas/domain";
import {
	getPresetRegistration,
	type PresetRegistration,
	presetCatalog,
} from "@/features/atlas/preset-catalog";

/**
 * The eager registration and the lazily loaded module describe the same preset twice: the
 * catalog needs an ID, a label, and a default projection before any chunk is fetched, so
 * persistence defaults and the preset selector can exist without downloading a map.
 *
 * Nothing used to check that the two agreed. A mismatch would initialise state under one key
 * and render another, or offer a projection the preset cannot draw — quietly, at runtime.
 */
export class PresetContractError extends Error {
	constructor(id: string, problems: string[]) {
		super(
			`The ${id} preset does not match its catalog registration: ${problems.join("; ")}.`,
		);
		this.name = "PresetContractError";
	}
}

function contractProblems(
	registration: PresetRegistration,
	preset: LoadedPreset,
): string[] {
	const { manifest } = preset;
	const problems: string[] = [];
	if (manifest.id !== registration.id)
		problems.push(
			`the manifest calls itself "${manifest.id}" but it is registered as "${registration.id}"`,
		);
	if (manifest.defaultProjection !== registration.defaultProjection)
		problems.push(
			`the manifest defaults to the ${manifest.defaultProjection} projection but the catalog offers ${registration.defaultProjection}`,
		);
	if (!manifest.projections.includes(manifest.defaultProjection))
		problems.push(
			`the default ${manifest.defaultProjection} projection is not among the supported projections`,
		);
	problems.push(...missingGroupHues(manifest, preset.groupHues));
	return problems;
}

/**
 * Every group a preset can render must have a hue. A missing one used to fall back silently to
 * the accent hue, so an incomplete preset looked finished.
 */
function missingGroupHues(
	manifest: PresetManifest,
	groupHues: Readonly<Record<string, number>>,
) {
	const declared = new Set(Object.keys(groupHues));
	const rendered = new Set(manifest.entities.map(({ groupId }) => groupId));
	const problems: string[] = [];
	const missing = [...rendered].filter((group) => !declared.has(group)).sort();
	const extra = [...declared].filter((group) => !rendered.has(group)).sort();
	if (missing.length > 0)
		problems.push(`no palette hue for ${missing.join(", ")}`);
	if (extra.length > 0)
		problems.push(
			`palette hues for groups it never renders: ${extra.join(", ")}`,
		);
	return problems;
}

export function validateLoadedPreset(
	registration: PresetRegistration,
	preset: LoadedPreset,
): LoadedPreset {
	const problems = contractProblems(registration, preset);
	if (problems.length > 0)
		throw new PresetContractError(registration.id, problems);
	return preset;
}

export async function loadPreset(id: PresetId): Promise<LoadedPreset> {
	const registration = getPresetRegistration(id);
	if (!registration) throw new Error(`Unknown map preset: ${id}`);
	return validateLoadedPreset(registration, await registration.load());
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
