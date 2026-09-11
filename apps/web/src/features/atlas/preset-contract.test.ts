import { describe, expect, it } from "vitest";

import { getSelectedFill } from "@/features/atlas/colors";
import type { LoadedPreset } from "@/features/atlas/domain";
import { createEmptyProgress } from "@/features/atlas/persistence-schema";
import type { PresetRegistration } from "@/features/atlas/preset-catalog";
import { presetCatalog } from "@/features/atlas/preset-catalog";
import {
	loadPreset,
	PresetContractError,
	validateLoadedPreset,
} from "@/features/atlas/preset-loader";
import { brazilPreset } from "@/features/atlas/presets/brazil";
import { spainPreset } from "@/features/atlas/presets/spain";
import { worldPreset } from "@/features/atlas/presets/world";
import {
	projectionLabel,
	projectionRegistry,
} from "@/features/atlas/projection-registry";
import { mixedManifest } from "@/test/mixed-preset";

const registration: PresetRegistration = {
	id: "mixed",
	label: "Mixed",
	defaultProjection: "mercator",
	load: async () => testPreset,
};

/**
 * A preset the product core has never heard of: a group it does not know and a projection
 * chosen from the registry, declared entirely by the preset module.
 */
const testPreset: LoadedPreset = {
	manifest: mixedManifest,
	geometryUrl: "maps/mixed.topo.json",
	attribution: "Synthetic fixture",
	groupHues: { "group-a": 300 },
	fit: "entities",
	insets: [],
};

describe("loaded preset contract", () => {
	it("accepts a preset that agrees with its registration", () => {
		expect(validateLoadedPreset(registration, testPreset)).toBe(testPreset);
	});

	it("rejects a manifest whose stable ID is not the registered one", () => {
		expect(() =>
			validateLoadedPreset({ ...registration, id: "elsewhere" }, testPreset),
		).toThrow(/calls itself "mixed" but it is registered as "elsewhere"/);
	});

	it("rejects a default projection the catalog does not offer", () => {
		expect(() =>
			validateLoadedPreset(
				{ ...registration, defaultProjection: "robinson" },
				testPreset,
			),
		).toThrow(
			/defaults to the mercator projection but the catalog offers robinson/,
		);
	});

	it("rejects a default projection the preset does not support", () => {
		expect(() =>
			validateLoadedPreset(registration, {
				...testPreset,
				manifest: { ...mixedManifest, projections: ["robinson"] },
			}),
		).toThrow(/not among the supported projections/);
	});

	it("rejects a palette that does not cover every selectable group", () => {
		expect(() =>
			validateLoadedPreset(registration, { ...testPreset, groupHues: {} }),
		).toThrow(/no palette hue for group-a/);
	});

	it("rejects palette policy for groups the preset never colors", () => {
		expect(() =>
			validateLoadedPreset(registration, {
				...testPreset,
				groupHues: { "group-a": 300, "group-ghost": 12 },
			}),
		).toThrow(/never colors: group-ghost/);
	});

	it("reports every problem at once, as a PresetContractError", () => {
		try {
			validateLoadedPreset(
				{ ...registration, id: "elsewhere", defaultProjection: "robinson" },
				{ ...testPreset, groupHues: {} },
			);
			throw new Error("expected the contract check to fail");
		} catch (error) {
			expect(error).toBeInstanceOf(PresetContractError);
			expect((error as Error).message).toContain("elsewhere");
			expect((error as Error).message).toContain("robinson");
			expect((error as Error).message).toContain("group-a");
		}
	});

	it("colors a group the product core has never heard of", () => {
		const entity = mixedManifest.entities[0];
		expect(
			getSelectedFill(
				entity,
				"hierarchical",
				createEmptyProgress("mercator"),
				undefined,
				testPreset.groupHues,
			),
		).toContain("300");
	});

	it("holds for every shipped preset", async () => {
		for (const entry of presetCatalog) {
			await expect(loadPreset(entry.id)).resolves.toMatchObject({
				manifest: { id: entry.id },
			});
		}
	});

	it("gives every shipped preset a hue for each selectable group", () => {
		for (const preset of [worldPreset, brazilPreset, spainPreset]) {
			const rendered = new Set(
				preset.manifest.entities
					.filter((entity) => entity.selectable)
					.map(({ groupId }) => groupId),
			);
			expect(Object.keys(preset.groupHues).sort()).toEqual(
				[...rendered].sort(),
			);
		}
	});
});

describe("projection registry", () => {
	it("gives every supported projection a label and a factory", () => {
		for (const preset of [worldPreset, brazilPreset, spainPreset]) {
			for (const id of preset.manifest.projections) {
				expect(projectionLabel(id)).toBeTruthy();
				expect(projectionRegistry[id].create()).toBeTypeOf("function");
			}
		}
	});

	it("keeps the current labels", () => {
		expect(projectionLabel("equal-earth")).toBe("Equal Earth");
		expect(projectionLabel("natural-earth")).toBe("Natural Earth");
		expect(projectionLabel("robinson")).toBe("Robinson");
		expect(projectionLabel("mercator")).toBe("Mercator");
	});
});
