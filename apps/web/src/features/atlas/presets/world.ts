import {
	type LoadedPreset,
	presetManifestSchema,
} from "@/features/atlas/domain";
import { geometryUrl } from "@/features/atlas/geometry-version";
import worldManifestData from "@/features/atlas/presets/data/world.manifest.json";

const manifest = presetManifestSchema.parse(worldManifestData);

export const worldPreset: LoadedPreset = {
	manifest,
	geometryUrl: geometryUrl("world"),
	attribution: "Natural Earth 5.1.1 · public domain",
	fit: "sphere",
	insets: [],
};
