import {
	type LoadedPreset,
	presetManifestSchema,
} from "@/features/atlas/domain";
import worldManifestData from "@/features/atlas/presets/data/world.manifest.json";

const manifest = presetManifestSchema.parse(worldManifestData);

export const worldPreset: LoadedPreset = {
	manifest,
	geometryUrl: "/maps/world.topo.json",
	attribution: "Natural Earth 5.1.1 · public domain",
	fit: "sphere",
	insets: [],
};
