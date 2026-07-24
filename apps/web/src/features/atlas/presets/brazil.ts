import {
	type LoadedPreset,
	presetManifestSchema,
} from "@/features/atlas/domain";
import brazilManifestData from "@/features/atlas/presets/data/brazil.manifest.json";
import { publicAssetUrl } from "@/lib/public-asset-url";

const manifest = presetManifestSchema.parse(brazilManifestData);

export const brazilPreset: LoadedPreset = {
	manifest,
	geometryUrl: publicAssetUrl("maps/brazil.topo.json"),
	attribution: "IBGE 2024 · official territorial mesh",
	fit: "entities",
	insets: [],
};
