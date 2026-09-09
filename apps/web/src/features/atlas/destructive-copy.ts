/**
 * The exact scope of every destructive action, in one place.
 *
 * These strings sit next to nothing but each other on purpose: the copy previously described a
 * narrower change than the store handler performed — preset reset also cleared the color mode,
 * and import also replaced projections, the active preset, and the theme — so a user could
 * confirm more than they were shown. Changing a handler without changing its sentence here
 * should feel wrong.
 */

export function resetPresetCopy(presetName: string) {
	return {
		title: `Reset ${presetName}?`,
		description: `This removes selections, custom colors, and the color mode for ${presetName}. Its projection and your other presets stay unchanged.`,
		confirm: `Reset ${presetName}`,
	};
}

export const resetAllCopy = {
	title: "Reset all local progress?",
	description:
		"This removes selections, custom colors, and color modes for every preset, and restores projections, the active preset, and the appearance preference to their defaults in this browser. Export first if you may want them later.",
	confirm: "Reset everything",
};

export const importCopy = {
	title: "Review imported progress",
	description:
		"This import will replace selections, custom colors, color modes, projections, the active preset, and the appearance preference stored in this browser. Review the changes below before replacing your current data. Map geometry is never imported.",
	confirm: "Replace local data",
};
