import { describe, expect, it } from "vitest";

import {
	getSelectedFill,
	isValidCustomColor,
	stableHash,
} from "@/features/atlas/colors";
import { brazilPreset } from "@/features/atlas/presets/brazil";
import {
	calculatePercentage,
	formatPercentage,
} from "@/features/atlas/progress";
import { createEmptyProgress } from "@/features/atlas/persistence-schema";

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
		const first = getSelectedFill(acre, "hierarchical", progress);
		expect(getSelectedFill(acre, "hierarchical", progress)).toBe(first);
		expect(getSelectedFill(amazonas, "hierarchical", progress)).toContain(
			"146",
		);
		expect(stableHash("br-ac")).toBe(stableHash("br-ac"));
	});

	it("uses validated custom colors and chronology metadata", () => {
		const entity = brazilPreset.manifest.entities[0];
		if (!entity) throw new Error("Brazil fixture missing");
		const progress = createEmptyProgress("mercator");
		progress.selected[entity.id] = {
			selectedAt: "2026-07-24T12:00:00.000Z",
			order: 1,
		};
		progress.customColors[entity.id] = "#123abc";
		expect(getSelectedFill(entity, "custom", progress)).toBe("#123abc");
		expect(getSelectedFill(entity, "chronology", progress)).toMatch(/^oklch/);
		expect(isValidCustomColor("#123abc")).toBe(true);
		expect(isValidCustomColor("red")).toBe(false);
	});
});
