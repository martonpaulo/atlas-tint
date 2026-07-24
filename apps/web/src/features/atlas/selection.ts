import type { ParentManifest } from "@/features/atlas/domain";
import type { SelectionMetadata } from "@/features/atlas/persistence-schema";

export type ParentSelectionState = "none" | "mixed" | "all";

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

export function toggleSelection(
	selected: Record<string, SelectionMetadata>,
	entityId: string,
	now: string,
): Record<string, SelectionMetadata> {
	if (selected[entityId]) {
		const { [entityId]: _removed, ...remaining } = selected;
		return remaining;
	}
	return {
		...selected,
		[entityId]: { selectedAt: now, order: nextSelectionOrder(selected) },
	};
}

export function setParentSelection(
	selected: Record<string, SelectionMetadata>,
	parent: ParentManifest,
	shouldSelect: boolean,
	now: string,
): Record<string, SelectionMetadata> {
	if (!shouldSelect) {
		return Object.fromEntries(
			Object.entries(selected).filter(([id]) => !parent.childIds.includes(id)),
		);
	}
	let order = nextSelectionOrder(selected);
	const additions = Object.fromEntries(
		parent.childIds
			.filter((id) => selected[id] === undefined)
			.map((id) => {
				const metadata = { selectedAt: now, order };
				order += 1;
				return [id, metadata];
			}),
	);
	return { ...selected, ...additions };
}
