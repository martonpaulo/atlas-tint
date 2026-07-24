import {
	type LoadedPreset,
	presetManifestSchema,
} from "@/features/atlas/domain";
import brazilManifestData from "@/features/atlas/presets/data/brazil.manifest.json";

const manifest = presetManifestSchema.parse(brazilManifestData);

export const brazilPreset: LoadedPreset = {
	manifest,
	geometryUrl: "/maps/brazil.topo.json",
	attribution: "IBGE 2024 · official territorial mesh",
	fit: "entities",
	insets: [],
};
