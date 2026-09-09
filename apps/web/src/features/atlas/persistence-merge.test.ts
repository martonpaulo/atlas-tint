import { describe, expect, it } from "vitest";

import {
	asReplacement,
	greatestStamp,
	mergeStates,
	restamp,
} from "@/features/atlas/persistence-merge";
import {
	createDefaultState,
	ORIGIN_STAMP,
	type PersistedState,
} from "@/features/atlas/persistence-schema";
import { spainPreset } from "@/features/atlas/presets/spain";
import {
	setParentSelection,
	toggleSelection,
} from "@/features/atlas/selection";
import { compareStamps, LamportClock, type Stamp } from "@/features/atlas/sync";

const NOW = "2026-07-24T12:00:00.000Z";

/** One tab: a clock, its own copy of the state, and the edits a user makes in it. */
function tab(actor: string, base: PersistedState = createDefaultState()) {
	const clock = new LamportClock(actor);
	clock.observe(greatestStamp(base));
	let state = structuredClone(base);
	const api = {
		get state() {
			return state;
		},
		observe(other: PersistedState) {
			clock.observe(greatestStamp(other));
			return api;
		},
		toggle(entityId: string, presetId = "world") {
			const progress = state.presets[presetId];
			state = {
				...state,
				presets: {
					...state.presets,
					[presetId]: {
						...progress,
						...toggleSelection(progress, entityId, NOW, clock.next()),
					},
				},
			};
			return api;
		},
		setProjection(projection: PersistedState["presets"][string]["projection"]) {
			const progress = state.presets.world;
			state = {
				...state,
				presets: {
					...state.presets,
					world: {
						...progress,
						projection,
						stamps: { ...progress.stamps, projection: clock.next() },
					},
				},
			};
			return api;
		},
		setColor(entityId: string, color: string) {
			const progress = state.presets.world;
			state = {
				...state,
				presets: {
					...state.presets,
					world: {
						...progress,
						customColors: { ...progress.customColors, [entityId]: color },
						stamps: {
							...progress.stamps,
							customColors: {
								...progress.stamps.customColors,
								[entityId]: clock.next(),
							},
						},
					},
				},
			};
			return api;
		},
	};
	return api;
}

const selectedIds = (state: PersistedState, presetId = "world") =>
	Object.keys(state.presets[presetId].selected).sort();

describe("cross-tab merge algebra", () => {
	const base = createDefaultState();
	const left = tab("aaaa").toggle("world-fr").setProjection("robinson").state;
	const right = tab("bbbb")
		.toggle("world-es")
		.setColor("world-es", "#112233").state;
	const third = tab("cccc").toggle("world-pt").state;

	it("is commutative", () => {
		expect(mergeStates(left, right)).toEqual(mergeStates(right, left));
	});

	it("is associative", () => {
		expect(mergeStates(mergeStates(left, right), third)).toEqual(
			mergeStates(left, mergeStates(right, third)),
		);
	});

	it("is idempotent", () => {
		const merged = mergeStates(left, right);
		expect(mergeStates(merged, merged)).toEqual(merged);
		expect(mergeStates(merged, left)).toEqual(merged);
	});

	it("has the base state as an identity", () => {
		expect(mergeStates(left, base)).toEqual(left);
	});
});

describe("cross-tab convergence", () => {
	it("keeps both selections when two tabs choose different regions", () => {
		const first = tab("aaaa").toggle("world-fr");
		const second = tab("bbbb").toggle("world-es");

		const merged = mergeStates(first.state, second.state);
		expect(selectedIds(merged)).toEqual(["world-es", "world-fr"]);
	});

	it("does not resurrect a deselection made against work the other tab never saw", () => {
		const shared = tab("aaaa").toggle("world-fr").toggle("world-es").state;
		// One tab removes France; the other independently adds Portugal.
		const remover = tab("aaaa", shared).observe(shared).toggle("world-fr");
		const adder = tab("bbbb", shared).observe(shared).toggle("world-pt");

		const merged = mergeStates(remover.state, adder.state);
		expect(selectedIds(merged)).toEqual(["world-es", "world-pt"]);
		expect(merged.presets.world.removed["world-fr"]).toBeDefined();
	});

	it("lets a re-selection after a deselection survive the tombstone", () => {
		const removed = tab("aaaa").toggle("world-fr").toggle("world-fr");
		const reselected = tab("aaaa", removed.state)
			.observe(removed.state)
			.toggle("world-fr");

		const merged = mergeStates(removed.state, reselected.state);
		expect(selectedIds(merged)).toEqual(["world-fr"]);
		expect(merged.presets.world.removed["world-fr"]).toBeUndefined();
	});

	it("resolves a same-entity conflict by the greater stamp, both ways round", () => {
		const shared = tab("aaaa").toggle("world-fr").state;
		// The remover acts after observing the selection, so its stamp is strictly greater.
		const remover = tab("bbbb", shared).observe(shared).toggle("world-fr");

		expect(selectedIds(mergeStates(shared, remover.state))).toEqual([]);
		expect(selectedIds(mergeStates(remover.state, shared))).toEqual([]);
	});

	it("breaks an exact tie on actor id, identically in both tabs", () => {
		const selection: Stamp = { counter: 7, actor: "aaaa" };
		const tombstone: Stamp = { counter: 7, actor: "bbbb" };
		expect(compareStamps(tombstone, selection)).toBeGreaterThan(0);

		const selectedState = createDefaultState();
		selectedState.presets.world.selected["world-fr"] = {
			selectedAt: NOW,
			order: 1,
			stamp: selection,
		};
		const removedState = createDefaultState();
		removedState.presets.world.removed["world-fr"] = tombstone;

		expect(selectedIds(mergeStates(selectedState, removedState))).toEqual([]);
		expect(selectedIds(mergeStates(removedState, selectedState))).toEqual([]);
	});

	it("merges independent preference edits instead of choosing one document", () => {
		const first = tab("aaaa").setProjection("robinson");
		const second = tab("bbbb").setColor("world-fr", "#aabbcc");

		const merged = mergeStates(first.state, second.state);
		expect(merged.presets.world.projection).toBe("robinson");
		expect(merged.presets.world.customColors["world-fr"]).toBe("#aabbcc");
	});

	it("merges independent children of the same parent group", () => {
		const andalusia = spainPreset.manifest.parents.find(
			({ id }) => id === "es-andalusia",
		);
		if (!andalusia) throw new Error("Andalusia fixture missing");

		const clock = new LamportClock("aaaa");
		const whole = createDefaultState();
		whole.presets.spain = {
			...whole.presets.spain,
			...setParentSelection(whole.presets.spain, andalusia, true, NOW, () =>
				clock.next(),
			),
		};
		const other = tab("bbbb").toggle("es-51", "spain");

		const merged = mergeStates(whole, other.state);
		expect(selectedIds(merged, "spain")).toHaveLength(
			andalusia.childIds.length + 1,
		);
	});

	it("keeps a preset record only one side knows about", () => {
		const withFuture = createDefaultState();
		withFuture.presets.future = withFuture.presets.world;

		expect(
			Object.keys(mergeStates(createDefaultState(), withFuture).presets),
		).toContain("future");
	});
});

describe("replacing progress with an import", () => {
	it("makes every field one deliberate local action", () => {
		const imported = tab("zzzz")
			.toggle("world-fr")
			.setProjection("mercator").state;
		const stamp: Stamp = { counter: 99, actor: "local" };

		const restamped = restamp(imported, stamp);
		expect(greatestStamp(restamped)).toEqual(stamp);
		expect(restamped.presets.world.selected["world-fr"]?.stamp).toEqual(stamp);
		expect(restamped.stamps.themePreference).toEqual(stamp);
	});

	it("removes local progress the imported file does not contain", () => {
		const local = tab("aaaa").toggle("world-fr").toggle("world-es");
		const stamp: Stamp = {
			counter: greatestStamp(local.state).counter + 1,
			actor: "aaaa",
		};
		const replacement = asReplacement(local.state, createDefaultState(), stamp);

		// An empty `selected` is not a claim; the tombstones are what make it one.
		expect(selectedIds(mergeStates(local.state, replacement))).toEqual([]);
		expect(Object.keys(replacement.presets.world.removed).sort()).toEqual([
			"world-es",
			"world-fr",
		]);
	});

	it("converges another tab on the replacement instead of undoing it", () => {
		const shared = tab("aaaa").toggle("world-fr").state;
		const other = tab("bbbb", shared).observe(shared);
		const replacement = asReplacement(shared, createDefaultState(), {
			counter: greatestStamp(shared).counter + 5,
			actor: "aaaa",
		});

		// The other tab still holds the pre-import selection and merges the replacement in.
		expect(selectedIds(mergeStates(other.state, replacement))).toEqual([]);
	});
});

describe("greatestStamp", () => {
	it("is the origin for an untouched record", () => {
		expect(greatestStamp(createDefaultState())).toEqual(ORIGIN_STAMP);
	});

	it("finds a stamp wherever it is written", () => {
		const state = tab("aaaa")
			.toggle("world-fr")
			.setColor("world-fr", "#123456").state;
		expect(greatestStamp(state).counter).toBe(2);
	});
});
