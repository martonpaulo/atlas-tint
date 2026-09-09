import { describe, expect, it } from "vitest";

import {
	chronologyFill,
	createChronologyContext,
	emptyChronologyContext,
	getSelectedFill,
	isValidCustomColor,
	stableHash,
} from "@/features/atlas/colors";
import {
	createEmptyProgress,
	ORIGIN_STAMP,
} from "@/features/atlas/persistence-schema";
import { brazilPreset } from "@/features/atlas/presets/brazil";
import {
	calculatePercentage,
	formatPercentage,
} from "@/features/atlas/progress";

describe("progress and deterministic colors", () => {
	it("calculates and formats bounded percentages", () => {
		expect(calculatePercentage(1, 195)).toBeCloseTo(0.5128, 3);
		expect(formatPercentage(1, 195)).toBe("0.5%");
		expect(formatPercentage(195, 195)).toBe("100%");
		expect(formatPercentage(2, 0)).toBe("0%");
	});

	it("keeps hierarchical colors stable and grouped", () => {
		const progress = createEmptyProgress("mercator");
		const acre = brazilPreset.manifest.entities.find(
			({ id }) => id === "br-ac",
		);
		const amazonas = brazilPreset.manifest.entities.find(
			({ id }) => id === "br-am",
		);
		if (!acre || !amazonas) throw new Error("Brazil fixtures missing");
		// The palette now comes from the preset, not from a table inside the colour engine.
		const hues = brazilPreset.groupHues;
		const fill = (entity: typeof acre) =>
			getSelectedFill(
				entity,
				"hierarchical",
				progress,
				emptyChronologyContext,
				hues,
			);
		const first = fill(acre);
		expect(fill(acre)).toBe(first);
		expect(fill(amazonas)).toContain("146");
		expect(stableHash("br-ac")).toBe(stableHash("br-ac"));
	});

	it("uses validated custom colors and chronology metadata", () => {
		const entity = brazilPreset.manifest.entities[0];
		if (!entity) throw new Error("Brazil fixture missing");
		const progress = createEmptyProgress("mercator");
		progress.selected[entity.id] = {
			selectedAt: "2026-07-24T12:00:00.000Z",
			order: 1,
			stamp: ORIGIN_STAMP,
		};
		progress.customColors[entity.id] = "#123abc";
		expect(getSelectedFill(entity, "custom", progress)).toBe("#123abc");
		expect(getSelectedFill(entity, "chronology", progress)).toMatch(/^oklch/);
		expect(isValidCustomColor("#123abc")).toBe(true);
		expect(isValidCustomColor("red")).toBe(false);
	});
});

describe("visit chronology colors", () => {
	const lightnessOf = (fill: string) => Number(fill.slice(6, 11));

	function selection(entries: Array<[string, number, string?]>) {
		return Object.fromEntries(
			entries.map(([id, order, selectedAt]) => [
				id,
				{
					selectedAt: selectedAt ?? `2026-07-24T12:00:0${order % 10}.000Z`,
					order,
					stamp: ORIGIN_STAMP,
				},
			]),
		);
	}

	it("keeps the endpoints valid after a middle selection is removed", () => {
		const full = createChronologyContext(
			selection([
				["a", 1],
				["b", 2],
				["c", 3],
			]),
		);
		expect(lightnessOf(chronologyFill("a", full))).toBeCloseTo(0.74, 3);
		expect(lightnessOf(chronologyFill("c", full))).toBeCloseTo(0.49, 3);

		// Removing B leaves stored orders 1 and 3; A and C must still be the two endpoints.
		const gapped = createChronologyContext(
			selection([
				["a", 1],
				["c", 3],
			]),
		);
		expect(lightnessOf(chronologyFill("a", gapped))).toBeCloseTo(0.74, 3);
		expect(lightnessOf(chronologyFill("c", gapped))).toBeCloseTo(0.49, 3);
	});

	it("never emits a value outside the scale, whatever the gaps", () => {
		const context = createChronologyContext(
			selection([
				["a", 1],
				["b", 5_000],
				["c", 1_000_000],
			]),
		);
		for (const id of ["a", "b", "c"]) {
			const lightness = lightnessOf(chronologyFill(id, context));
			expect(lightness).toBeGreaterThanOrEqual(0.49);
			expect(lightness).toBeLessThanOrEqual(0.74);
		}
	});

	it("resolves duplicate imported orders deterministically", () => {
		const duplicated = selection([
			["b", 1, "2026-07-24T12:00:00.000Z"],
			["a", 1, "2026-07-24T12:00:00.000Z"],
		]);
		const first = createChronologyContext(duplicated);
		const reversed = createChronologyContext(
			Object.fromEntries(Object.entries(duplicated).reverse()),
		);

		// Ties break on stable ID, so insertion order cannot change the result.
		expect(first.rankById.get("a")).toBe(0);
		expect(first.rankById.get("b")).toBe(1);
		expect(reversed.rankById.get("a")).toBe(0);
		expect(chronologyFill("a", first)).toBe(chronologyFill("a", reversed));
	});

	it("breaks an equal order on the earlier timestamp before the ID", () => {
		const context = createChronologyContext(
			selection([
				["z", 4, "2026-07-24T09:00:00.000Z"],
				["a", 4, "2026-07-24T18:00:00.000Z"],
			]),
		);
		expect(context.rankById.get("z")).toBe(0);
		expect(context.rankById.get("a")).toBe(1);
	});

	it("puts a single selection in the middle of the scale", () => {
		const context = createChronologyContext(selection([["a", 7]]));
		expect(lightnessOf(chronologyFill("a", context))).toBeCloseTo(0.615, 3);
	});

	it("renders a gapped selection through the public fill API at the endpoints", () => {
		const selected = selection([
			["world-fr", 1],
			["world-es", 3],
		]);
		const progress = { ...createEmptyProgress("mercator"), selected };
		const context = createChronologyContext(selected);
		const entity = (id: string) => ({
			id,
			geometryId: id,
			name: id,
			localNames: [],
			aliases: [],
			codes: [],
			groupId: "Europe",
			groupName: "Europe",
			groupAliases: [],
			selectable: true,
		});

		// Before the fix this produced oklch(0.240 …): stored order 3 in a set of 2.
		expect(
			getSelectedFill(entity("world-es"), "chronology", progress, context),
		).toBe("oklch(0.490 0.12 39)");
		expect(
			getSelectedFill(entity("world-fr"), "chronology", progress, context),
		).toBe("oklch(0.740 0.12 39)");
	});

	it("does not renumber the stored metadata it ranks", () => {
		const stored = selection([
			["a", 1],
			["c", 3],
		]);
		const snapshot = structuredClone(stored);
		createChronologyContext(stored);
		expect(stored).toEqual(snapshot);
	});
});
