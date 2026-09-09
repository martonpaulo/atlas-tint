import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	createPersistenceAdapter,
	serializePersistedState,
} from "@/features/atlas/persistence-adapter";
import {
	createDefaultState,
	migratePersistedState,
	persistedStateSchema,
	STORAGE_KEY,
	sanitizeUnknownEntityIds,
} from "@/features/atlas/persistence-schema";
import { useAtlasStore } from "@/features/atlas/store";

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
		expect(adapter.load()).toEqual({ mode: "durable", state });
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
		expect(result.mode).toBe("durable");
		expect(result.message).toMatch(/malformed/i);
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
		expect(adapter.load().mode).toBe("session-only");
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

	it("reports a newer schema as future-blocked and keeps its bytes opaque", () => {
		const record = '{"schemaVersion":2,"unknownField":"kept"}';
		const adapter = createPersistenceAdapter({
			getItem: () => record,
			setItem: () => undefined,
		});
		const result = adapter.load();
		expect(result.mode).toBe("future-blocked");
		expect(result.incompatibleRecord).toBe(record);
		expect(result.state).toEqual(createDefaultState());
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
		expect(persistedStateSchema.parse(state).presets.australia).toBeDefined();
	});
});

describe("persistence mode guards the storage key", () => {
	const futureRecord = '{"schemaVersion":2,"presets":{"world":"newer shape"}}';

	beforeEach(() => {
		vi.useFakeTimers();
		window.localStorage.clear();
		useAtlasStore.setState({
			data: createDefaultState(),
			hydrated: false,
			persistenceMode: "durable",
			incompatibleRecord: undefined,
			storageNotice: undefined,
			announcement: "",
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		window.localStorage.clear();
	});

	it("leaves a future record byte-identical across mutation, timers, and pagehide", () => {
		window.localStorage.setItem(STORAGE_KEY, futureRecord);
		const stop = useAtlasStore.getState().initialize();

		expect(useAtlasStore.getState().persistenceMode).toBe("future-blocked");
		useAtlasStore.getState().toggleEntity("world", "world-fr", "France");
		useAtlasStore.getState().setThemePreference("dark");
		vi.advanceTimersByTime(1_000);
		window.dispatchEvent(new Event("pagehide"));
		vi.advanceTimersByTime(1_000);

		expect(window.localStorage.getItem(STORAGE_KEY)).toBe(futureRecord);
		// The session itself stays usable in memory.
		expect(
			useAtlasStore.getState().data.presets.world.selected["world-fr"],
		).toBeDefined();
		stop();
	});

	it("ignores a cross-tab update while the stored record is incompatible", () => {
		window.localStorage.setItem(STORAGE_KEY, futureRecord);
		const stop = useAtlasStore.getState().initialize();

		window.dispatchEvent(
			new StorageEvent("storage", {
				key: STORAGE_KEY,
				newValue: serializePersistedState(createDefaultState()),
			}),
		);

		expect(useAtlasStore.getState().persistenceMode).toBe("future-blocked");
		expect(window.localStorage.getItem(STORAGE_KEY)).toBe(futureRecord);
		stop();
	});

	it("writes only after the explicit destructive replacement", () => {
		window.localStorage.setItem(STORAGE_KEY, futureRecord);
		const stop = useAtlasStore.getState().initialize();

		useAtlasStore.getState().replaceIncompatibleRecord();
		vi.advanceTimersByTime(1_000);

		const stored = window.localStorage.getItem(STORAGE_KEY);
		expect(stored).not.toBe(futureRecord);
		expect(JSON.parse(stored ?? "{}").schemaVersion).toBe(1);
		expect(useAtlasStore.getState().persistenceMode).toBe("durable");
		expect(useAtlasStore.getState().incompatibleRecord).toBeUndefined();
		stop();
	});

	it("keeps saving normally for a compatible record", () => {
		const stop = useAtlasStore.getState().initialize();

		expect(useAtlasStore.getState().persistenceMode).toBe("durable");
		useAtlasStore.getState().toggleEntity("world", "world-fr", "France");
		vi.advanceTimersByTime(1_000);

		const stored = window.localStorage.getItem(STORAGE_KEY);
		expect(
			JSON.parse(stored ?? "{}").presets.world.selected["world-fr"],
		).toBeDefined();
		stop();
	});
});
