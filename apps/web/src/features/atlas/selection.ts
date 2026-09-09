import type { ParentManifest } from "@/features/atlas/domain";
import type { SelectionMetadata } from "@/features/atlas/persistence-schema";
import type { Stamp } from "@/features/atlas/sync";

export type ParentSelectionState = "none" | "mixed" | "all";

/**
 * Selection is a pair, not a single record: what is selected, and what was deliberately
 * deselected. A merge cannot distinguish "never selected here" from "removed here" without the
 * second half, so every deselection leaves a stamped tombstone behind.
 */
export interface SelectionState {
	selected: Record<string, SelectionMetadata>;
	removed: Record<string, Stamp>;
}

export function getParentSelectionState(
	parent: ParentManifest,
	selected: Record<string, SelectionMetadata>,
): ParentSelectionState {
	const selectedCount = parent.childIds.filter(
		(id) => selected[id] !== undefined,
	).length;
	if (selectedCount === 0) return "none";
	if (selectedCount === parent.childIds.length) return "all";
	return "mixed";
}

export function nextSelectionOrder(
	selected: Record<string, SelectionMetadata>,
) {
	return Math.max(0, ...Object.values(selected).map(({ order }) => order)) + 1;
}

function select(
	state: SelectionState,
	entityId: string,
	now: string,
	stamp: Stamp,
	order: number,
): SelectionState {
	const { [entityId]: _resurrected, ...removed } = state.removed;
	return {
		selected: {
			...state.selected,
			[entityId]: { selectedAt: now, order, stamp },
		},
		removed,
	};
}

function deselect(
	state: SelectionState,
	entityId: string,
	stamp: Stamp,
): SelectionState {
	const { [entityId]: _deselected, ...selected } = state.selected;
	return { selected, removed: { ...state.removed, [entityId]: stamp } };
}

export function toggleSelection(
	state: SelectionState,
	entityId: string,
	now: string,
	stamp: Stamp,
): SelectionState {
	return state.selected[entityId]
		? deselect(state, entityId, stamp)
		: select(state, entityId, now, stamp, nextSelectionOrder(state.selected));
}

export function setParentSelection(
	state: SelectionState,
	parent: ParentManifest,
	shouldSelect: boolean,
	now: string,
	nextStamp: () => Stamp,
): SelectionState {
	// Each child gets its own stamp so two tabs editing different children of the same group
	// merge as the independent edits they are.
	let next = state;
	let order = nextSelectionOrder(state.selected);
	for (const id of parent.childIds) {
		if (shouldSelect) {
			if (next.selected[id] !== undefined) continue;
			next = select(next, id, now, nextStamp(), order);
			order += 1;
		} else {
			if (next.selected[id] === undefined) continue;
			next = deselect(next, id, nextStamp());
		}
	}
	return next;
}
