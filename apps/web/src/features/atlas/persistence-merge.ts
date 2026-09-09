import {
	CURRENT_SCHEMA_VERSION,
	createEmptyProgress,
	type PersistedState,
	type PresetProgress,
	type SelectionMetadata,
} from "@/features/atlas/persistence-schema";
import { getPresetRegistration } from "@/features/atlas/preset-catalog";
import { compareStamps, laterStamp, type Stamp } from "@/features/atlas/sync";

/**
 * Merge two versions of the same progress record, keeping every independent edit.
 *
 * The merge is commutative, associative, and idempotent, which is what makes two tabs converge
 * without either one being authoritative: each decides per field, both decide the same way, and
 * re-merging an already merged value changes nothing. Tests assert all three.
 */

function mergeStampedRecord<Value>(
	left: Record<string, Value>,
	right: Record<string, Value>,
	stampOf: (value: Value) => Stamp,
) {
	const merged: Record<string, Value> = { ...left };
	for (const [key, value] of Object.entries(right)) {
		const existing = merged[key];
		if (!existing || compareStamps(stampOf(value), stampOf(existing)) > 0)
			merged[key] = value;
	}
	return merged;
}

function pickLater<Value>(
	left: { value: Value; stamp: Stamp },
	right: { value: Value; stamp: Stamp },
) {
	return compareStamps(left.stamp, right.stamp) >= 0 ? left : right;
}

/**
 * A selection and its tombstone are two claims about the same entity. The later one wins, so a
 * deselection cannot be undone by another tab's older copy of the selection, and a re-selection
 * made after that deselection is not swallowed by the tombstone.
 */
function resolvePresence(
	selected: Record<string, SelectionMetadata>,
	removed: Record<string, Stamp>,
) {
	const resolvedSelected: Record<string, SelectionMetadata> = {};
	const resolvedRemoved: Record<string, Stamp> = {};
	for (const [id, metadata] of Object.entries(selected)) {
		const tombstone = removed[id];
		if (tombstone && compareStamps(tombstone, metadata.stamp) > 0)
			resolvedRemoved[id] = tombstone;
		else resolvedSelected[id] = metadata;
	}
	for (const [id, tombstone] of Object.entries(removed)) {
		if (!(id in selected)) resolvedRemoved[id] = tombstone;
	}
	return { selected: resolvedSelected, removed: resolvedRemoved };
}

export function mergeProgress(
	left: PresetProgress,
	right: PresetProgress,
): PresetProgress {
	const selected = mergeStampedRecord(
		left.selected,
		right.selected,
		({ stamp }) => stamp,
	);
	const removed = mergeStampedRecord(
		left.removed,
		right.removed,
		(stamp) => stamp,
	);
	const presence = resolvePresence(selected, removed);

	const customColorStamps = mergeStampedRecord(
		left.stamps.customColors,
		right.stamps.customColors,
		(stamp) => stamp,
	);
	const customColors: Record<string, string> = {};
	for (const id of Object.keys(customColorStamps)) {
		const leftStamp = left.stamps.customColors[id];
		const rightStamp = right.stamps.customColors[id];
		const preferLeft =
			leftStamp !== undefined &&
			(rightStamp === undefined || compareStamps(leftStamp, rightStamp) >= 0);
		const value = preferLeft ? left.customColors[id] : right.customColors[id];
		if (value !== undefined) customColors[id] = value;
	}

	const fillMode = pickLater(
		{ value: left.fillMode, stamp: left.stamps.fillMode },
		{ value: right.fillMode, stamp: right.stamps.fillMode },
	);
	const projection = pickLater(
		{ value: left.projection, stamp: left.stamps.projection },
		{ value: right.projection, stamp: right.stamps.projection },
	);

	return {
		selected: presence.selected,
		removed: presence.removed,
		fillMode: fillMode.value,
		customColors,
		projection: projection.value,
		stamps: {
			fillMode: fillMode.stamp,
			projection: projection.stamp,
			customColors: customColorStamps,
		},
	};
}

export function mergeStates(
	left: PersistedState,
	right: PersistedState,
): PersistedState {
	const presets: Record<string, PresetProgress> = {};
	for (const id of new Set([
		...Object.keys(left.presets),
		...Object.keys(right.presets),
	])) {
		const leftProgress = left.presets[id];
		const rightProgress = right.presets[id];
		presets[id] =
			leftProgress && rightProgress
				? mergeProgress(leftProgress, rightProgress)
				: (leftProgress ??
					rightProgress ??
					createEmptyProgress(
						getPresetRegistration(id)?.defaultProjection ?? "mercator",
					));
	}

	const activePresetId = pickLater(
		{ value: left.activePresetId, stamp: left.stamps.activePresetId },
		{ value: right.activePresetId, stamp: right.stamps.activePresetId },
	);
	const themePreference = pickLater(
		{ value: left.themePreference, stamp: left.stamps.themePreference },
		{ value: right.themePreference, stamp: right.stamps.themePreference },
	);

	return {
		schemaVersion: CURRENT_SCHEMA_VERSION,
		activePresetId: activePresetId.value,
		themePreference: themePreference.value,
		presets,
		stamps: {
			activePresetId: activePresetId.stamp,
			themePreference: themePreference.stamp,
		},
	};
}

/** The greatest stamp anywhere in a record, so a clock can be advanced past all of it. */
export function greatestStamp(state: PersistedState): Stamp {
	let greatest = laterStamp(
		state.stamps.activePresetId,
		state.stamps.themePreference,
	);
	for (const progress of Object.values(state.presets)) {
		greatest = laterStamp(greatest, progress.stamps.fillMode);
		greatest = laterStamp(greatest, progress.stamps.projection);
		for (const stamp of Object.values(progress.stamps.customColors))
			greatest = laterStamp(greatest, stamp);
		for (const { stamp } of Object.values(progress.selected))
			greatest = laterStamp(greatest, stamp);
		for (const stamp of Object.values(progress.removed))
			greatest = laterStamp(greatest, stamp);
	}
	return greatest;
}

/**
 * Rewrite every stamp in a record to one value.
 *
 * An imported file carries counters from whichever device produced it, which say nothing about
 * this tab's history. Restamping makes the import one deliberate local action that outranks
 * everything seen so far, rather than letting foreign counters decide local conflicts.
 */
export function restamp(state: PersistedState, stamp: Stamp): PersistedState {
	return {
		...state,
		presets: Object.fromEntries(
			Object.entries(state.presets).map(([id, progress]) => [
				id,
				{
					...progress,
					selected: Object.fromEntries(
						Object.entries(progress.selected).map(([entityId, metadata]) => [
							entityId,
							{ ...metadata, stamp },
						]),
					),
					removed: Object.fromEntries(
						Object.keys(progress.removed).map((entityId) => [entityId, stamp]),
					),
					stamps: {
						fillMode: stamp,
						projection: stamp,
						customColors: Object.fromEntries(
							Object.keys(progress.customColors).map((entityId) => [
								entityId,
								stamp,
							]),
						),
					},
				},
			]),
		),
		stamps: { activePresetId: stamp, themePreference: stamp },
	};
}

/**
 * Express "replace all progress with this" inside the merge algebra.
 *
 * An import is atomic replacement, but an empty `selected` record is not a claim that anything
 * was removed — merging it would simply keep whatever was already there, and the other tab would
 * put it all back. Every local selection the incoming record does not contain therefore becomes
 * a tombstone at the same stamp, so the replacement converges everywhere instead of only here.
 */
export function asReplacement(
	current: PersistedState,
	incoming: PersistedState,
	stamp: Stamp,
): PersistedState {
	const replacement = restamp(incoming, stamp);
	const presets: Record<string, PresetProgress> = { ...replacement.presets };
	for (const [id, progress] of Object.entries(current.presets)) {
		const next =
			presets[id] ??
			createEmptyProgress(
				getPresetRegistration(id)?.defaultProjection ?? progress.projection,
				stamp,
			);
		const removed = { ...next.removed };
		for (const entityId of Object.keys(progress.selected)) {
			if (!(entityId in next.selected)) removed[entityId] = stamp;
		}
		presets[id] = { ...next, removed };
	}
	return { ...replacement, presets };
}
