import {
	type LoadedPreset,
	presetManifestSchema,
} from "@/features/atlas/domain";
import worldManifestData from "@/features/atlas/presets/data/world.manifest.json";
import { publicAssetUrl } from "@/lib/public-asset-url";

const manifest = presetManifestSchema.parse(worldManifestData);

export const worldPreset: LoadedPreset = {
	manifest,
	geometryUrl: publicAssetUrl("maps/world.topo.json"),
	attribution: "Natural Earth 5.1.1 · public domain",
	fit: "sphere",
	insets: [],
};
