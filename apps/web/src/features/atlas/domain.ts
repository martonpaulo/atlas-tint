import { z } from "zod";

export const presetIdSchema = z
	.string()
	.min(1)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export type PresetId = z.infer<typeof presetIdSchema>;

export const projectionIdSchema = z.enum([
	"equal-earth",
	"natural-earth",
	"robinson",
	"mercator",
]);
export type ProjectionId = z.infer<typeof projectionIdSchema>;

export const fillModeSchema = z.enum([
	"hierarchical",
	"accent",
	"chronology",
	"custom",
]);
export type FillMode = z.infer<typeof fillModeSchema>;

export const themePreferenceSchema = z.enum(["light", "dark", "system"]);
export type ThemePreference = z.infer<typeof themePreferenceSchema>;

export const entityManifestSchema = z.object({
	id: z.string().min(1),
	geometryId: z.string().min(1),
	name: z.string().min(1),
	localNames: z.array(z.string()),
	aliases: z.array(z.string()),
	codes: z.array(z.string()),
	groupId: z.string().min(1),
	groupName: z.string().min(1),
	groupAliases: z.array(z.string()),
	selectable: z.boolean(),
	inset: z.string().optional(),
});
export type EntityManifest = z.infer<typeof entityManifestSchema>;

export const parentManifestSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	aliases: z.array(z.string()),
	childIds: z.array(z.string()),
});
export type ParentManifest = z.infer<typeof parentManifestSchema>;

export const presetManifestSchema = z.object({
	id: presetIdSchema,
	name: z.string().min(1),
	shortName: z.string().min(1),
	description: z.string().min(1),
	primaryTotal: z.number().int().positive(),
	defaultProjection: projectionIdSchema,
	projections: z.array(projectionIdSchema).min(1),
	entities: z.array(entityManifestSchema),
	parents: z.array(parentManifestSchema),
});
export type PresetManifest = z.infer<typeof presetManifestSchema>;

export interface LoadedPreset {
	manifest: PresetManifest;
	geometryUrl: string;
	attribution: string;
	fit: "sphere" | "entities";
	insets: ReadonlyArray<{
		key: string;
		label: string;
		x: number;
		y: number;
		width: number;
		height: number;
		padding: number;
	}>;
}
