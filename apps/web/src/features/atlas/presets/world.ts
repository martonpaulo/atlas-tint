import {
	type LoadedPreset,
	presetManifestSchema,
} from "@/features/atlas/domain";
import { geometryUrl } from "@/features/atlas/geometry-version";
import worldManifestData from "@/features/atlas/presets/data/world.manifest.json";

const manifest = presetManifestSchema.parse(worldManifestData);

/** Continent hues. The hierarchical palette varies each state deterministically within these. */
const groupHues = {
	Africa: 39,
	Asia: 102,
	Europe: 226,
	"North America": 184,
	"South America": 146,
	Oceania: 286,
};

export const worldPreset: LoadedPreset = {
	manifest,
	geometryUrl: geometryUrl("world"),
	attribution: "Natural Earth 5.1.1 · public domain",
	groupHues,
	fit: "sphere",
	insets: [],
};
