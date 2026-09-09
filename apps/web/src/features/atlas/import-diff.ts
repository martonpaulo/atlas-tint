import { fillModeLabels } from "@/features/atlas/colors";
import type { PresetManifest } from "@/features/atlas/domain";
import type { PersistedState } from "@/features/atlas/persistence-schema";

/**
 * What an import would actually change, category by category.
 *
 * The preview used to show selected counts only, while replacement also rewrote custom colors,
 * color modes, projections, the active preset, and the theme. A confirmation that discloses
 * less than the action performs is not a confirmation.
 */

export interface ImportDifference {
	/** The preset display name, or the application itself for top-level preferences. */
	scope: string;
	label: string;
	current: string;
	incoming: string;
	changed: boolean;
}

const projectionLabels: Record<string, string> = {
	"equal-earth": "Equal Earth",
	"natural-earth": "Natural Earth",
	robinson: "Robinson",
	mercator: "Mercator",
};

const themeLabels: Record<string, string> = {
	light: "Light",
	dark: "Dark",
	system: "System",
};

function difference(
	scope: string,
	label: string,
	current: string,
	incoming: string,
): ImportDifference {
	return { scope, label, current, incoming, changed: current !== incoming };
}

export function summarizeImport(
	current: PersistedState,
	incoming: PersistedState,
	manifests: Record<string, PresetManifest>,
): ImportDifference[] {
	const presetName = (id: string) => manifests[id]?.shortName ?? id;
	const differences: ImportDifference[] = [
		difference(
			"Application",
			"Active preset",
			presetName(current.activePresetId),
			presetName(incoming.activePresetId),
		),
		difference(
			"Application",
			"Appearance",
			themeLabels[current.themePreference] ?? current.themePreference,
			themeLabels[incoming.themePreference] ?? incoming.themePreference,
		),
	];

	for (const [id, manifest] of Object.entries(manifests)) {
		const before = current.presets[id];
		const after = incoming.presets[id];
		if (!before || !after) continue;
		const scope = manifest.shortName;
		differences.push(
			difference(
				scope,
				"Selected regions",
				`${Object.keys(before.selected).length} / ${manifest.primaryTotal}`,
				`${Object.keys(after.selected).length} / ${manifest.primaryTotal}`,
			),
			difference(
				scope,
				"Custom colors",
				`${Object.keys(before.customColors).length}`,
				`${Object.keys(after.customColors).length}`,
			),
			difference(
				scope,
				"Color mode",
				fillModeLabels[before.fillMode] ?? before.fillMode,
				fillModeLabels[after.fillMode] ?? after.fillMode,
			),
			difference(
				scope,
				"Projection",
				projectionLabels[before.projection] ?? before.projection,
				projectionLabels[after.projection] ?? after.projection,
			),
		);
	}

	return differences;
}

export function countChanges(differences: ImportDifference[]) {
	return differences.filter(({ changed }) => changed).length;
}
