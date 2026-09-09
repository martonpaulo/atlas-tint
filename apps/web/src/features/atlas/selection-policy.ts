import type {
	EntityManifest,
	ParentManifest,
	PresetManifest,
} from "@/features/atlas/domain";
import type { SelectionMetadata } from "@/features/atlas/persistence-schema";

/**
 * Who may be selected, according to the manifest and nothing else.
 *
 * `selectable` is part of the entity contract and of the progress total, but visibility used to
 * imply permission: the list rendered every entity, the map attached a handler to every matched
 * geometry, parent actions took every child ID, and the store accepted any ID at all. The first
 * visible territory or disputed geometry marked non-selectable would therefore have been
 * toggleable and would have pushed the selected count past a total that excludes it.
 *
 * Presentation asks this policy; it never infers permission from geometry.
 */
export interface SelectionPolicy {
	presetId: string;
	manifest: PresetManifest;
	/** Every entity in the manifest, selectable or not — visible geometry still needs a name. */
	entityById: ReadonlyMap<string, EntityManifest>;
	selectableIds: ReadonlySet<string>;
	/** Only the children a parent action may touch. */
	selectableChildIds: ReadonlyMap<string, readonly string[]>;
	/** The manifest-derived total, which is what progress is measured against. */
	primaryTotal: number;
}

/**
 * Policies are derived, not stored, and a manifest is a stable module-level value, so deriving
 * once per manifest keeps this out of every render without a memo in every component.
 */
const policyCache = new WeakMap<PresetManifest, SelectionPolicy>();

export function createSelectionPolicy(
	manifest: PresetManifest,
): SelectionPolicy {
	const cached = policyCache.get(manifest);
	if (cached) return cached;

	const entityById = new Map(
		manifest.entities.map((entity) => [entity.id, entity]),
	);
	const selectableIds = new Set(
		manifest.entities
			.filter(({ selectable }) => selectable)
			.map(({ id }) => id),
	);
	const selectableChildIds = new Map(
		manifest.parents.map((parent) => [
			parent.id,
			parent.childIds.filter((id) => selectableIds.has(id)),
		]),
	);

	const policy: SelectionPolicy = {
		presetId: manifest.id,
		manifest,
		entityById,
		selectableIds,
		selectableChildIds,
		primaryTotal: manifest.primaryTotal,
	};
	policyCache.set(manifest, policy);
	return policy;
}

export function isSelectable(policy: SelectionPolicy, entityId: string) {
	return policy.selectableIds.has(entityId);
}

export function isKnown(policy: SelectionPolicy, entityId: string) {
	return policy.entityById.has(entityId);
}

/** The children a parent checkbox represents: never the ones that may not be selected. */
export function selectableChildren(
	policy: SelectionPolicy,
	parent: ParentManifest,
): readonly string[] {
	return policy.selectableChildIds.get(parent.id) ?? [];
}

/**
 * Progress counts what the manifest says is selectable, so an ID that reached storage by any
 * other route cannot inflate it.
 */
export function countSelectable(
	policy: SelectionPolicy,
	selected: Record<string, SelectionMetadata>,
) {
	let count = 0;
	for (const id of Object.keys(selected)) {
		if (policy.selectableIds.has(id)) count += 1;
	}
	return count;
}

export interface SanitationReport {
	/** IDs the manifest has never heard of. */
	unknownIds: string[];
	/** IDs the manifest knows about but forbids selecting. */
	unavailableIds: string[];
}

export function partitionStoredIds(
	policy: SelectionPolicy,
	ids: readonly string[],
): SanitationReport {
	const unknownIds: string[] = [];
	const unavailableIds: string[] = [];
	for (const id of ids) {
		if (!policy.entityById.has(id)) unknownIds.push(id);
		else if (!policy.selectableIds.has(id)) unavailableIds.push(id);
	}
	return { unknownIds, unavailableIds };
}
