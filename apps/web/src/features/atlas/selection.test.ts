import { describe, expect, it } from "vitest";

import { spainPreset } from "@/features/atlas/presets/spain";
import {
	getParentSelectionState,
	type SelectionState,
	setParentSelection,
	toggleSelection,
} from "@/features/atlas/selection";
import { LamportClock } from "@/features/atlas/sync";

const NOW = "2026-07-24T12:00:00.000Z";
const empty: SelectionState = { selected: {}, removed: {} };

describe("selection rules", () => {
	const clock = new LamportClock("test");
	const andalusia = spainPreset.manifest.parents.find(
		({ id }) => id === "es-andalusia",
	);
	if (!andalusia) throw new Error("Andalusia fixture missing");

	it("selects and deselects every child of a parent", () => {
		const state = setParentSelection(empty, andalusia, true, NOW, () =>
			clock.next(),
		);
		expect(Object.keys(state.selected)).toHaveLength(8);
		expect(getParentSelectionState(andalusia, state.selected)).toBe("all");

		const cleared = setParentSelection(state, andalusia, false, NOW, () =>
			clock.next(),
		);
		expect(cleared.selected).toEqual({});
		// Deselection leaves a tombstone per child so another tab cannot resurrect them.
		expect(Object.keys(cleared.removed)).toHaveLength(8);
	});

	it("reports mixed parent state after one child is removed", () => {
		const state = setParentSelection(empty, andalusia, true, NOW, () =>
			clock.next(),
		);
		const partial = toggleSelection(state, "es-11", NOW, clock.next());
		expect(getParentSelectionState(andalusia, partial.selected)).toBe("mixed");
		expect(partial.removed["es-11"]).toBeDefined();
	});

	it("preserves deterministic selection order metadata", () => {
		const first = toggleSelection(empty, "world-fr", NOW, clock.next());
		const second = toggleSelection(first, "world-es", NOW, clock.next());
		expect(first.selected["world-fr"]?.order).toBe(1);
		expect(second.selected["world-es"]?.order).toBe(2);
	});

	it("clears the tombstone when an entity is selected again", () => {
		const selected = toggleSelection(empty, "world-fr", NOW, clock.next());
		const removed = toggleSelection(selected, "world-fr", NOW, clock.next());
		expect(removed.removed["world-fr"]).toBeDefined();

		const reselected = toggleSelection(removed, "world-fr", NOW, clock.next());
		expect(reselected.selected["world-fr"]).toBeDefined();
		expect(reselected.removed["world-fr"]).toBeUndefined();
	});

	it("gives each child of a parent its own stamp", () => {
		const state = setParentSelection(empty, andalusia, true, NOW, () =>
			clock.next(),
		);
		const counters = Object.values(state.selected).map(
			({ stamp }) => stamp.counter,
		);
		expect(new Set(counters).size).toBe(counters.length);
	});
});
