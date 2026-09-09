import {
	type LoadedPreset,
	presetManifestSchema,
} from "@/features/atlas/domain";
import { geometryUrl } from "@/features/atlas/geometry-version";
import brazilManifestData from "@/features/atlas/presets/data/brazil.manifest.json";

const manifest = presetManifestSchema.parse(brazilManifestData);

/** One hue per official geographic region. */
const groupHues = {
	"br-north": 146,
	"br-northeast": 58,
	"br-central-west": 88,
	"br-southeast": 218,
	"br-south": 292,
};

export const brazilPreset: LoadedPreset = {
	manifest,
	geometryUrl: geometryUrl("brazil"),
	attribution: "IBGE 2024 · official territorial mesh",
	groupHues,
	fit: "entities",
	insets: [],
};
