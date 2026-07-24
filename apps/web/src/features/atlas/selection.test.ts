import { describe, expect, it } from "vitest";

import { spainPreset } from "@/features/atlas/presets/spain";
import {
	getParentSelectionState,
	setParentSelection,
	toggleSelection,
} from "@/features/atlas/selection";

const NOW = "2026-07-24T12:00:00.000Z";

describe("selection rules", () => {
	const andalusia = spainPreset.manifest.parents.find(
		({ id }) => id === "es-andalusia",
	);
	if (!andalusia) throw new Error("Andalusia fixture missing");

	it("selects and deselects every child of a parent", () => {
		const selected = setParentSelection({}, andalusia, true, NOW);
		expect(Object.keys(selected)).toHaveLength(8);
		expect(getParentSelectionState(andalusia, selected)).toBe("all");
		expect(setParentSelection(selected, andalusia, false, NOW)).toEqual({});
	});

	it("reports mixed parent state after one child is removed", () => {
		const selected = setParentSelection({}, andalusia, true, NOW);
		const partial = toggleSelection(selected, "es-11", NOW);
		expect(getParentSelectionState(andalusia, partial)).toBe("mixed");
	});

	it("preserves deterministic selection order metadata", () => {
		const first = toggleSelection({}, "world-fr", NOW);
		const second = toggleSelection(first, "world-es", NOW);
		expect(first["world-fr"]?.order).toBe(1);
		expect(second["world-es"]?.order).toBe(2);
	});
});
