import { create } from "zustand";

import type {
	FillMode,
	ParentManifest,
	PresetId,
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
	asReplacement,
	greatestStamp,
	mergeStates,
} from "@/features/atlas/persistence-merge";
import {
	createDefaultState,
	createEmptyProgress,
	migratePersistedState,
	type PersistedState,
	STORAGE_KEY,
	sanitizeUnknownEntityIds,
} from "@/features/atlas/persistence-schema";
import {
	setParentSelection,
	toggleSelection,
} from "@/features/atlas/selection";
import {
	isSelectable,
	partitionStoredIds,
	type SelectionPolicy,
	selectableChildren,
} from "@/features/atlas/selection-policy";
import { createActorId, LamportClock } from "@/features/atlas/sync";

interface AtlasStore {
	data: PersistedState;
	hydrated: boolean;
	persistenceMode: PersistenceMode;
	/** Untouched bytes of an incompatible newer record, offered back as a download. */
	incompatibleRecord?: string;
	storageNotice?: string;
	announcement: string;
	initialize: () => () => void;
	setActivePreset: (id: PresetId) => void;
	sanitizePreset: (policy: SelectionPolicy) => void;
	/**
	 * Selection actions take the policy rather than a preset ID, so a caller cannot reach them
	 * without the manifest contract that says which entities may be selected at all.
	 */
	toggleEntity: (
		policy: SelectionPolicy,
		entityId: string,
		entityName: string,
	) => void;
	setParent: (
		policy: SelectionPolicy,
		parent: ParentManifest,
		shouldSelect: boolean,
	) => void;
	setFillMode: (presetId: PresetId, mode: FillMode) => void;
	setCustomColor: (
		policy: SelectionPolicy,
		entityId: string,
		color: string,
	) => void;
	setProjection: (presetId: PresetId, projection: ProjectionId) => void;
	setThemePreference: (theme: ThemePreference) => void;
	resetPreset: (presetId: PresetId) => void;
	resetAll: () => void;
	replaceData: (data: PersistedState, message: string) => void;
	/** Explicit destructive transition: overwrite an incompatible newer record with this session. */
	replaceIncompatibleRecord: () => void;
}

let persistenceAdapter: PersistenceAdapter | undefined;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let pendingSave:
	| {
			data: PersistedState;
			onFailure: (message: string) => void;
			onMerged: (state: PersistedState) => void;
	  }
	| undefined;

/**
 * This tab's Lamport clock. Session-scoped: a reload is a new participant, which is fine because
 * a reload also reads whatever the previous session durably wrote and advances past its stamps.
 */
let clock = new LamportClock(createActorId());

/**
 * Rebase pending intent on whatever is durable right now, then write once.
 *
 * Between scheduling a write and performing it, another tab may have written. Persisting the
 * local snapshot as-is would drop that work; merging first keeps both, because every field
 * carries a stamp and the merge is per field. A whole-document last-writer-wins is what this
 * replaces.
 */
function flushSave() {
	if (!pendingSave || !persistenceAdapter) return;
	if (saveTimer) clearTimeout(saveTimer);
	const { data, onFailure, onMerged } = pendingSave;
	pendingSave = undefined;
	saveTimer = undefined;
	const durable = persistenceAdapter.load();
	const merged =
		durable.mode === "durable" ? mergeStates(durable.state, data) : data;
	clock.observe(greatestStamp(merged));
	const result = persistenceAdapter.save(merged);
	if (result.ok) onMerged(merged);
	else onFailure(result.message);
}

function scheduleSave(
	data: PersistedState,
	onFailure: (message: string) => void,
	onMerged: (state: PersistedState) => void,
) {
	if (!persistenceAdapter) return;
	if (saveTimer) clearTimeout(saveTimer);
	pendingSave = { data, onFailure, onMerged };
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
	clock = new LamportClock(createActorId());
}

export const useAtlasStore = create<AtlasStore>((set, get) => {
	const commit = (data: PersistedState, announcement = get().announcement) => {
		set({ data, announcement });
		// A session that may not write stays fully usable in memory; it simply never schedules a
		// write, so no timer, storage event, or `pagehide` can reach the storage key.
		if (!canPersist(get().persistenceMode)) return;
		scheduleSave(
			data,
			(storageNotice) => set({ persistenceMode: "save-failed", storageNotice }),
			// The written value is the merge of local intent with whatever another tab had
			// already durably written, so the visible state has to become that merge too.
			(merged) => set({ data: merged }),
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
				clock.observe(greatestStamp(result.state));
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
					const remote = migratePersistedState(JSON.parse(event.newValue));
					// Merge rather than adopt: this tab may hold intent the other one never saw.
					const merged = mergeStates(remote, get().data);
					clock.observe(greatestStamp(merged));
					set({ data: merged, storageNotice: undefined });
					// Only write back when this tab actually knows something the record does not,
					// so two tabs cannot ping-pong events at each other forever.
					if (
						canPersist(get().persistenceMode) &&
						JSON.stringify(merged) !== JSON.stringify(remote)
					)
						commit(merged);
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
			const data = get().data;
			commit({
				...data,
				activePresetId: id,
				stamps: { ...data.stamps, activePresetId: clock.next() },
			});
		},
		sanitizePreset(policy) {
			// Only the selectable set is retained: a known-but-unavailable ID must not survive
			// in progress, or it would keep counting toward a total that excludes it.
			const result = sanitizeUnknownEntityIds(
				get().data,
				policy.presetId,
				policy.selectableIds,
			);
			if (result.removedIds.length === 0) return;
			const { unknownIds, unavailableIds } = partitionStoredIds(
				policy,
				result.removedIds,
			);
			const parts: string[] = [];
			if (unknownIds.length > 0)
				parts.push(
					`${unknownIds.length} unknown saved ${unknownIds.length === 1 ? "region was" : "regions were"} ignored`,
				);
			if (unavailableIds.length > 0)
				parts.push(
					`${unavailableIds.length} saved ${unavailableIds.length === 1 ? "region is" : "regions are"} no longer selectable and ${unavailableIds.length === 1 ? "was" : "were"} removed`,
				);
			commit(result.state, `${parts.join(", ")}.`);
		},
		toggleEntity(policy, entityId, entityName) {
			if (!isSelectable(policy, entityId)) return;
			const presetId = policy.presetId;
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
							...toggleSelection(
								progress,
								entityId,
								new Date().toISOString(),
								clock.next(),
							),
						},
					},
				},
				`${entityName} ${wasSelected ? "deselected" : "selected"}.`,
			);
		},
		setParent(policy, parent, shouldSelect) {
			const childIds = selectableChildren(policy, parent);
			if (childIds.length === 0) return;
			const presetId = policy.presetId;
			const data = get().data;
			const progress = data.presets[presetId];
			commit(
				{
					...data,
					presets: {
						...data.presets,
						[presetId]: {
							...progress,
							...setParentSelection(
								progress,
								// A parent action reaches only the children the manifest allows.
								{ ...parent, childIds: [...childIds] },
								shouldSelect,
								new Date().toISOString(),
								() => clock.next(),
							),
						},
					},
				},
				`${parent.name} ${shouldSelect ? "selected" : "deselected"}.`,
			);
		},
		setFillMode(presetId, mode) {
			const data = get().data;
			const progress = data.presets[presetId];
			commit({
				...data,
				presets: {
					...data.presets,
					[presetId]: {
						...progress,
						fillMode: mode,
						stamps: { ...progress.stamps, fillMode: clock.next() },
					},
				},
			});
		},
		setCustomColor(policy, entityId, color) {
			if (!isSelectable(policy, entityId)) return;
			const presetId = policy.presetId;
			const data = get().data;
			const progress = data.presets[presetId];
			commit({
				...data,
				presets: {
					...data.presets,
					[presetId]: {
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
			});
		},
		setProjection(presetId, projection) {
			const data = get().data;
			const progress = data.presets[presetId];
			commit({
				...data,
				presets: {
					...data.presets,
					[presetId]: {
						...progress,
						projection,
						stamps: { ...progress.stamps, projection: clock.next() },
					},
				},
			});
		},
		setThemePreference(themePreference) {
			const data = get().data;
			commit({
				...data,
				themePreference,
				stamps: { ...data.stamps, themePreference: clock.next() },
			});
		},
		resetPreset(presetId) {
			const data = get().data;
			const progress = data.presets[presetId];
			const stamp = clock.next();
			commit(
				{
					...data,
					presets: {
						...data.presets,
						// A reset is a deselection of everything, so it leaves tombstones. Without
						// them another tab's copy would put the whole preset straight back.
						[presetId]: {
							...createEmptyProgress(progress.projection, stamp),
							removed: {
								...progress.removed,
								...Object.fromEntries(
									Object.keys(progress.selected).map((id) => [id, stamp]),
								),
							},
						},
					},
				},
				"Current preset progress reset.",
			);
		},
		resetAll() {
			const data = get().data;
			const stamp = clock.next();
			const cleared = createDefaultState(stamp);
			for (const [presetId, progress] of Object.entries(data.presets)) {
				const empty =
					cleared.presets[presetId] ??
					createEmptyProgress(progress.projection, stamp);
				cleared.presets[presetId] = {
					...empty,
					removed: {
						...progress.removed,
						...Object.fromEntries(
							Object.keys(progress.selected).map((id) => [id, stamp]),
						),
					},
				};
			}
			commit(cleared, "All local progress reset.");
		},
		replaceData(data, message) {
			// An imported file was stamped by whichever device produced it, and those counters
			// say nothing about this tab's history. Restamp it as one deliberate local action,
			// and turn everything it does not contain into a tombstone, so the replacement is
			// atomic in every tab rather than only in this one.
			commit(asReplacement(get().data, data, clock.next()), message);
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
