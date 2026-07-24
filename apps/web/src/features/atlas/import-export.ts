import { z } from "zod";

import type { PresetManifest } from "@/features/atlas/domain";
import {
	CURRENT_SCHEMA_VERSION,
	type PersistedStateV1,
	persistedStateV1Schema,
	reconcilePresetCatalog,
	sanitizeUnknownEntityIds,
} from "@/features/atlas/persistence-schema";

export const APPLICATION_VERSION = "1.0.0";

export const atlasExportSchema = z.object({
	format: z.literal("atlas-tint-progress"),
	schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
	applicationVersion: z.string().min(1),
	exportedAt: z.iso.datetime(),
	state: persistedStateV1Schema,
});
export type AtlasExport = z.infer<typeof atlasExportSchema>;

export interface ImportPreview {
	state: PersistedStateV1;
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
	state: PersistedStateV1,
	now = new Date(),
): AtlasExport {
	return {
		format: "atlas-tint-progress",
		schemaVersion: CURRENT_SCHEMA_VERSION,
		applicationVersion: APPLICATION_VERSION,
		exportedAt: now.toISOString(),
		state: persistedStateV1Schema.parse(state),
	};
}

export function serializeAtlasExport(
	state: PersistedStateV1,
	now = new Date(),
) {
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
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return { ok: false, message: "The selected file is not valid JSON." };
	}
	const result = atlasExportSchema.safeParse(parsed);
	if (!result.success)
		return { ok: false, message: issueMessage(result.error) };
	let state = reconcilePresetCatalog(result.data.state);
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
			exportedAt: result.data.exportedAt,
			applicationVersion: result.data.applicationVersion,
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
