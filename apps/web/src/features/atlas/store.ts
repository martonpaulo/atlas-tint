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
	createBrowserPersistenceAdapter,
	type PersistenceAdapter,
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
}

let persistenceAdapter: PersistenceAdapter | undefined;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let pendingSave:
	| {
			data: PersistedStateV1;
			setNotice: (message: string | undefined) => void;
	  }
	| undefined;

function flushSave() {
	if (!pendingSave || !persistenceAdapter) return;
	if (saveTimer) clearTimeout(saveTimer);
	const { data, setNotice } = pendingSave;
	pendingSave = undefined;
	saveTimer = undefined;
	const result = persistenceAdapter.save(data);
	if (!result.ok) setNotice(result.message);
}

function scheduleSave(
	data: PersistedStateV1,
	setNotice: (message: string | undefined) => void,
) {
	if (!persistenceAdapter) return;
	if (saveTimer) clearTimeout(saveTimer);
	pendingSave = { data, setNotice };
	saveTimer = setTimeout(flushSave, 80);
}

export const useAtlasStore = create<AtlasStore>((set, get) => {
	const commit = (
		data: PersistedStateV1,
		announcement = get().announcement,
	) => {
		set({ data, announcement });
		scheduleSave(data, (storageNotice) => set({ storageNotice }));
	};

	return {
		data: createDefaultState(),
		hydrated: false,
		announcement: "",
		initialize() {
			persistenceAdapter = createBrowserPersistenceAdapter();
			const result = persistenceAdapter.load();
			set({
				data: result.state,
				hydrated: true,
				storageNotice: result.status === "ok" ? undefined : result.message,
			});
			if (typeof window === "undefined") return () => undefined;
			const handleStorage = (event: StorageEvent) => {
				if (event.key !== STORAGE_KEY || event.newValue === null) return;
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
			return () => {
				window.removeEventListener("storage", handleStorage);
				window.removeEventListener("pagehide", flushSave);
			};
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
	};
});
