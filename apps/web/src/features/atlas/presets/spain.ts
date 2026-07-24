import {
	type LoadedPreset,
	presetManifestSchema,
} from "@/features/atlas/domain";
import spainManifestData from "@/features/atlas/presets/data/spain.manifest.json";
import { publicAssetUrl } from "@/lib/public-asset-url";

const manifest = presetManifestSchema.parse(spainManifestData);

export const spainPreset: LoadedPreset = {
	manifest,
	geometryUrl: publicAssetUrl("maps/spain.topo.json"),
	attribution: "Derived from BDLJE · CC BY 4.0 · ign.es",
	fit: "entities",
	insets: [
		{
			key: "ceuta",
			label: "Ceuta · inset",
			x: 32,
			y: 326,
			width: 125,
			height: 96,
			padding: 14,
		},
		{
			key: "melilla",
			label: "Melilla · inset",
			x: 169,
			y: 326,
			width: 125,
			height: 96,
			padding: 14,
		},
		{
			key: "canary",
			label: "Canary Islands · inset",
			x: 32,
			y: 448,
			width: 262,
			height: 162,
			padding: 16,
		},
	],
};
