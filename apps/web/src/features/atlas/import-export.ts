import { z } from "zod";

import { type PresetManifest, presetIdSchema } from "@/features/atlas/domain";
import { formatByteLimit, importLimits } from "@/features/atlas/import-limits";
import {
	CURRENT_SCHEMA_VERSION,
	migratePersistedState,
	type PersistedState,
	persistedStateSchema,
	presetProgressSchema,
	reconcilePresetCatalog,
	sanitizeUnknownEntityIds,
	selectionMetadataSchema,
} from "@/features/atlas/persistence-schema";

export const APPLICATION_VERSION = "1.0.0";

const boundedKey = z.string().min(1).max(importLimits.maxKeyLength);

function boundedRecord<Value extends z.ZodTypeAny>(
	value: Value,
	limit: number,
	subject: string,
) {
	return z
		.record(boundedKey, value)
		.refine((record) => Object.keys(record).length <= limit, {
			message: `at most ${limit} ${subject} are accepted`,
		});
}

/**
 * The storage schema stays permissive so an existing local record always migrates. An imported
 * file is untrusted input, so it is bounded here instead, including for preset records this
 * build does not recognise: a forward-compatible record still may not retain unbounded state.
 */
const boundedProgressSchema = presetProgressSchema.extend({
	selected: boundedRecord(
		selectionMetadataSchema,
		importLimits.maxSelections,
		"selected regions per preset",
	),
	customColors: boundedRecord(
		z.string().regex(/^#[0-9a-fA-F]{6}$/, "must be a #rrggbb colour"),
		importLimits.maxCustomColors,
		"custom colours per preset",
	),
});

const boundedStateSchema = persistedStateSchema.extend({
	presets: z
		.record(presetIdSchema, boundedProgressSchema)
		.refine(
			(presets) => Object.keys(presets).length <= importLimits.maxPresets,
			{
				message: `at most ${importLimits.maxPresets} preset records are accepted`,
			},
		),
});

export const atlasExportSchema = z.object({
	format: z.literal("atlas-tint-progress"),
	schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
	applicationVersion: z.string().min(1),
	exportedAt: z.iso.datetime(),
	state: boundedStateSchema,
});

/**
 * The envelope, without committing to a state shape.
 *
 * A file exported before cross-tab stamps existed is still a valid export of someone's
 * progress, so the state is migrated through the same path as stored data and only then
 * bounded. Refusing it would make an upgrade destroy a user's backup.
 */
const importEnvelopeSchema = z.object({
	format: z.literal("atlas-tint-progress"),
	schemaVersion: z.union([z.literal(1), z.literal(CURRENT_SCHEMA_VERSION)]),
	applicationVersion: z.string().min(1),
	exportedAt: z.iso.datetime(),
	state: z.unknown(),
});
export type AtlasExport = z.infer<typeof atlasExportSchema>;

export interface ImportPreview {
	state: PersistedState;
	exportedAt: string;
	applicationVersion: string;
	presets: ReadonlyArray<{
		id: string;
		name: string;
		selectedCount: number;
		total: number;
	}>;
	unknownIds: Record<string, string[]>;
}

export type ImportResult =
	| { ok: true; preview: ImportPreview }
	| { ok: false; message: string };

export function createAtlasExport(
	state: PersistedState,
	now = new Date(),
): AtlasExport {
	return {
		format: "atlas-tint-progress",
		schemaVersion: CURRENT_SCHEMA_VERSION,
		applicationVersion: APPLICATION_VERSION,
		exportedAt: now.toISOString(),
		state: persistedStateSchema.parse(state),
	};
}

export function serializeAtlasExport(state: PersistedState, now = new Date()) {
	return `${JSON.stringify(createAtlasExport(state, now), null, 2)}\n`;
}

function issueMessage(error: z.ZodError) {
	const issue = error.issues[0];
	if (!issue) return "The selected file is not a valid AtlasTint export.";
	const path = issue.path.join(".");
	return `Invalid AtlasTint export${path ? ` at ${path}` : ""}: ${issue.message}`;
}

export function validateImportText(
	text: string,
	manifests: Record<string, PresetManifest>,
): ImportResult {
	// Re-check after reading: `File.size` is reported by the file, and a custom `File`
	// implementation can under-report it. Parsing is the expensive step, so gate before it.
	const byteLength = new TextEncoder().encode(text).byteLength;
	if (byteLength > importLimits.maxBytes) {
		return {
			ok: false,
			message: `The selected file is ${formatByteLimit(byteLength)}, over the ${formatByteLimit(importLimits.maxBytes)} import limit.`,
		};
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return { ok: false, message: "The selected file is not valid JSON." };
	}
	const envelope = importEnvelopeSchema.safeParse(parsed);
	if (!envelope.success)
		return { ok: false, message: issueMessage(envelope.error) };

	let migrated: unknown;
	try {
		migrated = migratePersistedState(envelope.data.state);
	} catch {
		return {
			ok: false,
			message:
				"Invalid AtlasTint export: the progress it contains is not a supported shape.",
		};
	}

	const result = boundedStateSchema.safeParse(migrated);
	if (!result.success)
		return { ok: false, message: issueMessage(result.error) };
	let state = reconcilePresetCatalog(result.data);
	const unknownIds: Record<string, string[]> = {};
	for (const [id, manifest] of Object.entries(manifests)) {
		const sanitized = sanitizeUnknownEntityIds(
			state,
			id,
			new Set(manifest.entities.map((entity) => entity.id)),
		);
		state = sanitized.state;
		unknownIds[id] = sanitized.removedIds;
	}
	return {
		ok: true,
		preview: {
			state,
			exportedAt: envelope.data.exportedAt,
			applicationVersion: envelope.data.applicationVersion,
			presets: Object.entries(manifests).map(([id, manifest]) => ({
				id,
				name: manifest.shortName,
				selectedCount: Object.keys(state.presets[id].selected).length,
				total: manifest.primaryTotal,
			})),
			unknownIds,
		},
	};
}
