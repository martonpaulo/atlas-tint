import { z } from "zod";

import {
	fillModeSchema,
	type PresetId,
	presetIdSchema,
	projectionIdSchema,
	themePreferenceSchema,
} from "@/features/atlas/domain";
import {
	defaultPresetId,
	getPresetRegistration,
	isAvailablePresetId,
	presetCatalog,
} from "@/features/atlas/preset-catalog";
import { type Stamp, stampSchema } from "@/features/atlas/sync";

export const STORAGE_KEY = "atlas-tint:state";
export const CURRENT_SCHEMA_VERSION = 2;

/** What a field written before stamps existed counts as. Every real stamp outranks it. */
export const ORIGIN_STAMP: Stamp = { counter: 0, actor: "" };

export const selectionMetadataSchema = z.object({
	selectedAt: z.iso.datetime(),
	order: z.number().int().positive(),
	visitDate: z.iso.date().optional(),
	/** When this selection happened in Lamport order, which is what merging compares. */
	stamp: stampSchema,
});
export type SelectionMetadata = z.infer<typeof selectionMetadataSchema>;

/**
 * Stamps for the fields that hold a single value rather than a record.
 *
 * They sit beside the data instead of wrapping it, so every consumer keeps reading
 * `progress.fillMode` and `progress.customColors[id]` unchanged and only mutation and merge
 * know stamps exist. A test asserts the two never drift apart.
 */
export const presetStampsSchema = z.object({
	fillMode: stampSchema,
	projection: stampSchema,
	customColors: z.record(z.string(), stampSchema),
});
export type PresetStamps = z.infer<typeof presetStampsSchema>;

export const presetProgressSchema = z.object({
	selected: z.record(z.string(), selectionMetadataSchema),
	/**
	 * Deselections, kept as stamps. Without them a merge cannot tell "never selected" from
	 * "deselected", so the other tab's older copy would resurrect what the user just removed.
	 */
	removed: z.record(z.string(), stampSchema),
	fillMode: fillModeSchema,
	customColors: z.record(z.string(), z.string()),
	projection: projectionIdSchema,
	stamps: presetStampsSchema,
});
export type PresetProgress = z.infer<typeof presetProgressSchema>;

export const rootStampsSchema = z.object({
	activePresetId: stampSchema,
	themePreference: stampSchema,
});
export type RootStamps = z.infer<typeof rootStampsSchema>;

export const persistedStateSchema = z.object({
	schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
	activePresetId: presetIdSchema,
	themePreference: themePreferenceSchema,
	presets: z.record(presetIdSchema, presetProgressSchema),
	stamps: rootStampsSchema,
});
export type PersistedState = z.infer<typeof persistedStateSchema>;

const legacyStateSchema = z
	.object({
		schemaVersion: z.literal(0).optional(),
		activePresetId: presetIdSchema.optional(),
		themePreference: themePreferenceSchema.optional(),
		selectedIds: z.array(z.string()).optional(),
		selections: z.record(z.string(), z.array(z.string())).optional(),
	})
	.refine(
		(value) =>
			value.schemaVersion === 0 ||
			value.selectedIds !== undefined ||
			value.selections !== undefined,
		{ message: "Not a supported legacy state." },
	);

export function createEmptyProgress(
	projection: PresetProgress["projection"],
	stamp: Stamp = ORIGIN_STAMP,
): PresetProgress {
	return {
		selected: {},
		removed: {},
		fillMode: "hierarchical",
		customColors: {},
		projection,
		stamps: { fillMode: stamp, projection: stamp, customColors: {} },
	};
}

export function createDefaultState(
	stamp: Stamp = ORIGIN_STAMP,
): PersistedState {
	return {
		schemaVersion: CURRENT_SCHEMA_VERSION,
		activePresetId: defaultPresetId,
		themePreference: "system",
		presets: Object.fromEntries(
			presetCatalog.map(({ id, defaultProjection }) => [
				id,
				createEmptyProgress(defaultProjection, stamp),
			]),
		),
		stamps: { activePresetId: stamp, themePreference: stamp },
	};
}

export function reconcilePresetCatalog(state: PersistedState): PersistedState {
	const presets = { ...state.presets };
	for (const { id, defaultProjection } of presetCatalog) {
		presets[id] ??= createEmptyProgress(defaultProjection);
	}
	return {
		...state,
		activePresetId: isAvailablePresetId(state.activePresetId)
			? state.activePresetId
			: defaultPresetId,
		presets,
	};
}

function selectionRecord(ids: string[]) {
	const baseTime = Date.UTC(2000, 0, 1);
	return Object.fromEntries(
		ids.map((id, index) => [
			id,
			{
				selectedAt: new Date(baseTime + index * 1_000).toISOString(),
				order: index + 1,
				stamp: ORIGIN_STAMP,
			},
		]),
	);
}

/** Version 1: the same values, with no stamps and no tombstones. */
const version1StateSchema = z.object({
	schemaVersion: z.literal(1),
	activePresetId: presetIdSchema,
	themePreference: themePreferenceSchema,
	presets: z.record(
		presetIdSchema,
		z.object({
			selected: z.record(
				z.string(),
				z.object({
					selectedAt: z.iso.datetime(),
					order: z.number().int().positive(),
					visitDate: z.iso.date().optional(),
				}),
			),
			fillMode: fillModeSchema,
			customColors: z.record(z.string(), z.string()),
			projection: projectionIdSchema,
		}),
	),
});

/**
 * Everything a version-1 record contains was written before this tab existed, so it all carries
 * the origin stamp: any later edit in any tab outranks it, and no version-1 value can win a
 * conflict against work done after the upgrade.
 */
function migrateVersion1(value: z.infer<typeof version1StateSchema>) {
	const presets = Object.fromEntries(
		Object.entries(value.presets).map(([id, progress]) => [
			id,
			{
				selected: Object.fromEntries(
					Object.entries(progress.selected).map(([entityId, metadata]) => [
						entityId,
						{ ...metadata, stamp: ORIGIN_STAMP },
					]),
				),
				removed: {},
				fillMode: progress.fillMode,
				customColors: progress.customColors,
				projection: progress.projection,
				stamps: {
					fillMode: ORIGIN_STAMP,
					projection: ORIGIN_STAMP,
					customColors: Object.fromEntries(
						Object.keys(progress.customColors).map((entityId) => [
							entityId,
							ORIGIN_STAMP,
						]),
					),
				},
			},
		]),
	);
	return {
		schemaVersion: CURRENT_SCHEMA_VERSION,
		activePresetId: value.activePresetId,
		themePreference: value.themePreference,
		presets,
		stamps: {
			activePresetId: ORIGIN_STAMP,
			themePreference: ORIGIN_STAMP,
		},
	} satisfies PersistedState;
}

export function migratePersistedState(value: unknown): PersistedState {
	const current = persistedStateSchema.safeParse(value);
	if (current.success) return reconcilePresetCatalog(current.data);
	const version1 = version1StateSchema.safeParse(value);
	if (version1.success)
		return reconcilePresetCatalog(migrateVersion1(version1.data));
	const legacy = legacyStateSchema.safeParse(value);
	if (!legacy.success)
		throw new Error("Stored progress does not match a supported schema.");
	const migrated = createDefaultState();
	migrated.activePresetId =
		legacy.data.activePresetId &&
		isAvailablePresetId(legacy.data.activePresetId)
			? legacy.data.activePresetId
			: defaultPresetId;
	migrated.themePreference = legacy.data.themePreference ?? "system";
	const selections = legacy.data.selections ?? {};
	for (const { id } of presetCatalog) {
		const legacyIds =
			id === defaultPresetId
				? (legacy.data.selectedIds ?? selections[id] ?? [])
				: (selections[id] ?? []);
		migrated.presets[id].selected = selectionRecord(legacyIds);
	}
	return migrated;
}

export function sanitizeUnknownEntityIds(
	state: PersistedState,
	presetId: PresetId,
	knownIds: ReadonlySet<string>,
) {
	const progress =
		state.presets[presetId] ??
		createEmptyProgress(
			getPresetRegistration(presetId)?.defaultProjection ?? "mercator",
		);
	const keep = <Value>(record: Record<string, Value>) =>
		Object.fromEntries(
			Object.entries(record).filter(([id]) => knownIds.has(id)),
		);
	const selected = keep(progress.selected);
	const customColors = keep(progress.customColors);
	// Tombstones are bounded by the manifest: one per entity that can be deselected at all.
	const removed = keep(progress.removed);
	const removedIds = Object.keys(progress.selected).filter(
		(id) => !knownIds.has(id),
	);
	return {
		state: {
			...state,
			presets: {
				...state.presets,
				[presetId]: {
					...progress,
					selected,
					customColors,
					removed,
					stamps: {
						...progress.stamps,
						customColors: keep(progress.stamps.customColors),
					},
				},
			},
		},
		removedIds,
	};
}
