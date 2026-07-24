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

export const STORAGE_KEY = "atlas-tint:state";
export const CURRENT_SCHEMA_VERSION = 1;

export const selectionMetadataSchema = z.object({
	selectedAt: z.iso.datetime(),
	order: z.number().int().positive(),
	visitDate: z.iso.date().optional(),
});
export type SelectionMetadata = z.infer<typeof selectionMetadataSchema>;

export const presetProgressSchema = z.object({
	selected: z.record(z.string(), selectionMetadataSchema),
	fillMode: fillModeSchema,
	customColors: z.record(z.string(), z.string()),
	projection: projectionIdSchema,
});
export type PresetProgress = z.infer<typeof presetProgressSchema>;

export const persistedStateV1Schema = z.object({
	schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
	activePresetId: presetIdSchema,
	themePreference: themePreferenceSchema,
	presets: z.record(presetIdSchema, presetProgressSchema),
});
export type PersistedStateV1 = z.infer<typeof persistedStateV1Schema>;

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
): PresetProgress {
	return {
		selected: {},
		fillMode: "hierarchical",
		customColors: {},
		projection,
	};
}

export function createDefaultState(): PersistedStateV1 {
	return {
		schemaVersion: CURRENT_SCHEMA_VERSION,
		activePresetId: defaultPresetId,
		themePreference: "system",
		presets: Object.fromEntries(
			presetCatalog.map(({ id, defaultProjection }) => [
				id,
				createEmptyProgress(defaultProjection),
			]),
		),
	};
}

export function reconcilePresetCatalog(
	state: PersistedStateV1,
): PersistedStateV1 {
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
			},
		]),
	);
}

export function migratePersistedState(value: unknown): PersistedStateV1 {
	const current = persistedStateV1Schema.safeParse(value);
	if (current.success) return reconcilePresetCatalog(current.data);
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
	state: PersistedStateV1,
	presetId: PresetId,
	knownIds: ReadonlySet<string>,
) {
	const progress =
		state.presets[presetId] ??
		createEmptyProgress(
			getPresetRegistration(presetId)?.defaultProjection ?? "mercator",
		);
	const selected = Object.fromEntries(
		Object.entries(progress.selected).filter(([id]) => knownIds.has(id)),
	);
	const customColors = Object.fromEntries(
		Object.entries(progress.customColors).filter(([id]) => knownIds.has(id)),
	);
	const removedIds = Object.keys(progress.selected).filter(
		(id) => !knownIds.has(id),
	);
	return {
		state: {
			...state,
			presets: {
				...state.presets,
				[presetId]: { ...progress, selected, customColors },
			},
		},
		removedIds,
	};
}
