import { create } from "zustand";

import type {
	FillMode,
	ParentManifest,
	PresetId,
	PresetManifest,
	ProjectionId,
	ThemePreference,
} from "@/features/atlas/domain";
import {
	canPersist,
	createBrowserPersistenceAdapter,
	type PersistenceAdapter,
	type PersistenceMode,
} from "@/features/atlas/persistence-adapter";
import {
	createDefaultState,
	migratePersistedState,
	type PersistedStateV1,
	STORAGE_KEY,
	sanitizeUnknownEntityIds,
} from "@/features/atlas/persistence-schema";
import {
	setParentSelection,
	toggleSelection,
} from "@/features/atlas/selection";

interface AtlasStore {
	data: PersistedStateV1;
	hydrated: boolean;
	persistenceMode: PersistenceMode;
	/** Untouched bytes of an incompatible newer record, offered back as a download. */
	incompatibleRecord?: string;
	storageNotice?: string;
	announcement: string;
	initialize: () => () => void;
	setActivePreset: (id: PresetId) => void;
	sanitizePreset: (manifest: PresetManifest) => void;
	toggleEntity: (
		presetId: PresetId,
		entityId: string,
		entityName: string,
	) => void;
	setParent: (
		presetId: PresetId,
		parent: ParentManifest,
		shouldSelect: boolean,
	) => void;
	setFillMode: (presetId: PresetId, mode: FillMode) => void;
	setCustomColor: (presetId: PresetId, entityId: string, color: string) => void;
	setProjection: (presetId: PresetId, projection: ProjectionId) => void;
	setThemePreference: (theme: ThemePreference) => void;
	resetPreset: (presetId: PresetId) => void;
	resetAll: () => void;
	replaceData: (data: PersistedStateV1, message: string) => void;
	/** Explicit destructive transition: overwrite an incompatible newer record with this session. */
	replaceIncompatibleRecord: () => void;
}

let persistenceAdapter: PersistenceAdapter | undefined;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let pendingSave:
	| {
			data: PersistedStateV1;
			onFailure: (message: string) => void;
	  }
	| undefined;

function flushSave() {
	if (!pendingSave || !persistenceAdapter) return;
	if (saveTimer) clearTimeout(saveTimer);
	const { data, onFailure } = pendingSave;
	pendingSave = undefined;
	saveTimer = undefined;
	const result = persistenceAdapter.save(data);
	if (!result.ok) onFailure(result.message);
}

function scheduleSave(
	data: PersistedStateV1,
	onFailure: (message: string) => void,
) {
	if (!persistenceAdapter) return;
	if (saveTimer) clearTimeout(saveTimer);
	pendingSave = { data, onFailure };
	saveTimer = setTimeout(flushSave, 80);
}

/** Drop a scheduled write so a blocked or replaced session can never flush it later. */
function discardPendingSave() {
	if (saveTimer) clearTimeout(saveTimer);
	pendingSave = undefined;
	saveTimer = undefined;
}

/**
 * Window listeners are owned for the lifetime of the application, not of any component that
 * happens to be mounted. `undefined` means none are attached.
 */
let detachListeners: (() => void) | undefined;

/**
 * Reset every module-scoped persistence global.
 *
 * Only for tests: the adapter, the debounce timer, and the listener registration outlive any
 * single render, which is exactly the property under test, so cases need a way back to a clean
 * start without relying on module reloading.
 */
export function resetAtlasPersistence() {
	detachListeners?.();
	discardPendingSave();
	persistenceAdapter = undefined;
}

export const useAtlasStore = create<AtlasStore>((set, get) => {
	const commit = (
		data: PersistedStateV1,
		announcement = get().announcement,
	) => {
		set({ data, announcement });
		// A session that may not write stays fully usable in memory; it simply never schedules a
		// write, so no timer, storage event, or `pagehide` can reach the storage key.
		if (!canPersist(get().persistenceMode)) return;
		scheduleSave(data, (storageNotice) =>
			set({ persistenceMode: "save-failed", storageNotice }),
		);
	};

	return {
		data: createDefaultState(),
		hydrated: false,
		persistenceMode: "durable",
		announcement: "",
		initialize() {
			// Hydrate exactly once per session. A later call — a remount, a second lifecycle, a
			// StrictMode double effect — must never treat storage as newer than the in-memory
			// state the user has been editing.
			if (!get().hydrated) {
				persistenceAdapter = createBrowserPersistenceAdapter();
				discardPendingSave();
				const result = persistenceAdapter.load();
				set({
					data: result.state,
					hydrated: true,
					persistenceMode: result.mode,
					incompatibleRecord: result.incompatibleRecord,
					storageNotice: result.message,
				});
			}
			if (typeof window === "undefined") return () => undefined;
			if (detachListeners) return detachListeners;
			const handleStorage = (event: StorageEvent) => {
				if (event.key !== STORAGE_KEY || event.newValue === null) return;
				// The record is newer than this build understands; adopting it would reinterpret
				// unknown data through the current schema.
				if (get().persistenceMode === "future-blocked") return;
				try {
					const parsed: unknown = JSON.parse(event.newValue);
					set({
						data: migratePersistedState(parsed),
						storageNotice: undefined,
					});
				} catch {
					set({
						storageNotice:
							"A cross-tab progress update was invalid and was ignored.",
					});
				}
			};
			window.addEventListener("storage", handleStorage);
			window.addEventListener("pagehide", flushSave);
			detachListeners = () => {
				// Tearing down the application is the last chance to make pending intent durable.
				// `flushSave` is already a no-op for a session that may not write.
				flushSave();
				window.removeEventListener("storage", handleStorage);
				window.removeEventListener("pagehide", flushSave);
				detachListeners = undefined;
			};
			return detachListeners;
		},
		setActivePreset(id) {
			commit({ ...get().data, activePresetId: id });
		},
		sanitizePreset(manifest) {
			const result = sanitizeUnknownEntityIds(
				get().data,
				manifest.id,
				new Set(manifest.entities.map(({ id }) => id)),
			);
			if (result.removedIds.length > 0) {
				commit(
					result.state,
					`${result.removedIds.length} unknown saved ${result.removedIds.length === 1 ? "region was" : "regions were"} ignored.`,
				);
			}
		},
		toggleEntity(presetId, entityId, entityName) {
			const data = get().data;
			const progress = data.presets[presetId];
			const wasSelected = progress.selected[entityId] !== undefined;
			commit(
				{
					...data,
					presets: {
						...data.presets,
						[presetId]: {
							...progress,
							selected: toggleSelection(
								progress.selected,
								entityId,
								new Date().toISOString(),
							),
						},
					},
				},
				`${entityName} ${wasSelected ? "deselected" : "selected"}.`,
			);
		},
		setParent(presetId, parent, shouldSelect) {
			const data = get().data;
			const progress = data.presets[presetId];
			commit(
				{
					...data,
					presets: {
						...data.presets,
						[presetId]: {
							...progress,
							selected: setParentSelection(
								progress.selected,
								parent,
								shouldSelect,
								new Date().toISOString(),
							),
						},
					},
				},
				`${parent.name} ${shouldSelect ? "selected" : "deselected"}.`,
			);
		},
		setFillMode(presetId, mode) {
			const data = get().data;
			commit({
				...data,
				presets: {
					...data.presets,
					[presetId]: { ...data.presets[presetId], fillMode: mode },
				},
			});
		},
		setCustomColor(presetId, entityId, color) {
			const data = get().data;
			const progress = data.presets[presetId];
			commit({
				...data,
				presets: {
					...data.presets,
					[presetId]: {
						...progress,
						customColors: { ...progress.customColors, [entityId]: color },
					},
				},
			});
		},
		setProjection(presetId, projection) {
			const data = get().data;
			commit({
				...data,
				presets: {
					...data.presets,
					[presetId]: { ...data.presets[presetId], projection },
				},
			});
		},
		setThemePreference(themePreference) {
			commit({ ...get().data, themePreference });
		},
		resetPreset(presetId) {
			const data = get().data;
			const projection = data.presets[presetId].projection;
			commit(
				{
					...data,
					presets: {
						...data.presets,
						[presetId]: {
							selected: {},
							fillMode: "hierarchical",
							customColors: {},
							projection,
						},
					},
				},
				"Current preset progress reset.",
			);
		},
		resetAll() {
			commit(createDefaultState(), "All local progress reset.");
		},
		replaceData(data, message) {
			commit(data, message);
		},
		replaceIncompatibleRecord() {
			set({
				persistenceMode: "durable",
				incompatibleRecord: undefined,
				storageNotice: undefined,
			});
			commit(get().data, "Incompatible saved progress replaced.");
		},
	};
});
