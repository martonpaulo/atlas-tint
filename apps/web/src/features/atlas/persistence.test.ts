import { describe, expect, it } from "vitest";

import {
	createPersistenceAdapter,
	serializePersistedState,
} from "@/features/atlas/persistence-adapter";
import {
	STORAGE_KEY,
	createDefaultState,
	migratePersistedState,
	persistedStateV1Schema,
	sanitizeUnknownEntityIds,
} from "@/features/atlas/persistence-schema";

describe("persistence", () => {
	it("serializes and loads version 1 state including projection preferences", () => {
		const values = new Map<string, string>();
		const storage = {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => values.set(key, value),
		};
		const state = createDefaultState();
		state.presets.world.projection = "robinson";
		const adapter = createPersistenceAdapter(storage);
		expect(adapter.save(state)).toEqual({ ok: true });
		expect(adapter.load()).toEqual({ status: "ok", state });
		expect(
			JSON.parse(serializePersistedState(state)).presets.world.projection,
		).toBe("robinson");
	});

	it("migrates the legacy version-0 fixture into ordered version 1 metadata", () => {
		const migrated = migratePersistedState({
			schemaVersion: 0,
			activePresetId: "world",
			selectedIds: ["world-fr", "world-es"],
		});
		expect(migrated.schemaVersion).toBe(1);
		expect(migrated.presets.world.selected["world-fr"]?.order).toBe(1);
		expect(migrated.presets.world.selected["world-es"]?.order).toBe(2);
	});

	it("recovers safely from malformed JSON", () => {
		const adapter = createPersistenceAdapter({
			getItem: () => "{broken",
			setItem: () => undefined,
		});
		const result = adapter.load();
		expect(result.status).toBe("recovered");
		expect(result.state).toEqual(createDefaultState());
	});

	it("remains usable when storage APIs throw", () => {
		const adapter = createPersistenceAdapter({
			getItem: () => {
				throw new DOMException("Denied");
			},
			setItem: () => {
				throw new DOMException("Quota");
			},
		});
		expect(adapter.load().status).toBe("unavailable");
		expect(adapter.save(createDefaultState())).toEqual({
			ok: false,
			message: "AtlasTint could not save progress in browser storage.",
		});
	});

	it("ignores unknown entity IDs without affecting known progress", () => {
		const state = createDefaultState();
		state.presets.world.selected = {
			"world-fr": { selectedAt: "2026-07-24T12:00:00.000Z", order: 1 },
			"world-unknown": { selectedAt: "2026-07-24T12:00:01.000Z", order: 2 },
		};
		const result = sanitizeUnknownEntityIds(
			state,
			"world",
			new Set(["world-fr"]),
		);
		expect(result.removedIds).toEqual(["world-unknown"]);
		expect(Object.keys(result.state.presets.world.selected)).toEqual([
			"world-fr",
		]);
	});

	it("uses the expected versioned storage key", () => {
		expect(STORAGE_KEY).toBe("atlas-tint:state");
	});

	it("accepts progress for presets added outside the initial catalog", () => {
		const state = createDefaultState();
		state.presets.australia = {
			selected: {},
			fillMode: "hierarchical",
			customColors: {},
			projection: "mercator",
		};
		expect(persistedStateV1Schema.parse(state).presets.australia).toBeDefined();
	});
});
