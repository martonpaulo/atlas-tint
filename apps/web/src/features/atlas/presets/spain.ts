import {
	type LoadedPreset,
	presetManifestSchema,
} from "@/features/atlas/domain";
import { geometryUrl } from "@/features/atlas/geometry-version";
import spainManifestData from "@/features/atlas/presets/data/spain.manifest.json";

const manifest = presetManifestSchema.parse(spainManifestData);

/** One hue per autonomous community, plus the two autonomous cities. */
const groupHues = {
	"es-andalusia": 46,
	"es-aragon": 73,
	"es-asturias": 203,
	"es-balearic-islands": 178,
	"es-basque-country": 155,
	"es-canary-islands": 25,
	"es-cantabria": 189,
	"es-castile-and-leon": 91,
	"es-castile-la-mancha": 61,
	"es-catalonia": 12,
	"es-extremadura": 123,
	"es-galicia": 211,
	"es-la-rioja": 335,
	"es-madrid": 283,
	"es-murcia": 355,
	"es-navarre": 166,
	"es-valencian-community": 31,
	"es-ceuta": 242,
	"es-melilla": 264,
};

export const spainPreset: LoadedPreset = {
	manifest,
	geometryUrl: geometryUrl("spain"),
	attribution: "Derived from BDLJE · CC BY 4.0 · ign.es",
	groupHues,
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
