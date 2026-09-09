import { describe, expect, it } from "vitest";

import { presetManifestSchema } from "@/features/atlas/domain";
import { ORIGIN_STAMP } from "@/features/atlas/persistence-schema";
import { brazilPreset } from "@/features/atlas/presets/brazil";
import { spainPreset } from "@/features/atlas/presets/spain";
import { worldPreset } from "@/features/atlas/presets/world";
import {
	countSelectable,
	createSelectionPolicy,
	isKnown,
	isSelectable,
	partitionStoredIds,
	selectableChildren,
} from "@/features/atlas/selection-policy";
import { entity, mixedManifest } from "@/test/mixed-preset";

describe("selection policy", () => {
	const policy = createSelectionPolicy(mixedManifest);

	it("knows every entity but only allows selecting the selectable ones", () => {
		expect(isKnown(policy, "mx-territory")).toBe(true);
		expect(isSelectable(policy, "mx-territory")).toBe(false);
		expect(isSelectable(policy, "mx-a")).toBe(true);
		expect(isKnown(policy, "mx-nowhere")).toBe(false);
		expect(isSelectable(policy, "mx-nowhere")).toBe(false);
	});

	it("gives a parent only the children that may be selected", () => {
		expect(selectableChildren(policy, mixedManifest.parents[0])).toEqual([
			"mx-a",
			"mx-b",
		]);
	});

	it("returns no children for a parent whose children are all unavailable", () => {
		const noneSelectable = createSelectionPolicy(
			presetManifestSchema.parse({
				...mixedManifest,
				id: "none",
				primaryTotal: 1,
				entities: [entity("mx-a", true), entity("mx-only", false, "group-b")],
				parents: [
					{
						id: "group-b",
						name: "Group B",
						aliases: [],
						childIds: ["mx-only"],
					},
				],
			}),
		);
		expect(
			selectableChildren(noneSelectable, {
				id: "group-b",
				name: "Group B",
				aliases: [],
				childIds: ["mx-only"],
			}),
		).toEqual([]);
	});

	it("counts progress from the selectable set, not from what is stored", () => {
		const stored = {
			"mx-a": {
				selectedAt: "2026-07-24T12:00:00.000Z",
				order: 1,
				stamp: ORIGIN_STAMP,
			},
			"mx-territory": {
				selectedAt: "2026-07-24T12:00:01.000Z",
				order: 2,
				stamp: ORIGIN_STAMP,
			},
			"mx-nowhere": {
				selectedAt: "2026-07-24T12:00:02.000Z",
				order: 3,
				stamp: ORIGIN_STAMP,
			},
		};
		expect(Object.keys(stored)).toHaveLength(3);
		expect(countSelectable(policy, stored)).toBe(1);
	});

	it("tells an unknown ID apart from a known but unavailable one", () => {
		expect(
			partitionStoredIds(policy, ["mx-a", "mx-territory", "mx-nowhere"]),
		).toEqual({
			unknownIds: ["mx-nowhere"],
			unavailableIds: ["mx-territory"],
		});
	});

	it("derives one policy per manifest instead of one per call", () => {
		expect(createSelectionPolicy(mixedManifest)).toBe(policy);
	});

	it("leaves the shipped all-selectable presets fully selectable", () => {
		for (const preset of [worldPreset, brazilPreset, spainPreset]) {
			const shipped = createSelectionPolicy(preset.manifest);
			expect(shipped.selectableIds.size).toBe(preset.manifest.entities.length);
			expect(shipped.selectableIds.size).toBe(preset.manifest.primaryTotal);
			for (const parent of preset.manifest.parents) {
				expect(selectableChildren(shipped, parent)).toEqual(parent.childIds);
			}
		}
	});
});
