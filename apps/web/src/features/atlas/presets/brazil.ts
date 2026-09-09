import {
	type LoadedPreset,
	presetManifestSchema,
} from "@/features/atlas/domain";
import { geometryUrl } from "@/features/atlas/geometry-version";
import brazilManifestData from "@/features/atlas/presets/data/brazil.manifest.json";

const manifest = presetManifestSchema.parse(brazilManifestData);

export const brazilPreset: LoadedPreset = {
	manifest,
	geometryUrl: geometryUrl("brazil"),
	attribution: "IBGE 2024 · official territorial mesh",
	fit: "entities",
	insets: [],
};
