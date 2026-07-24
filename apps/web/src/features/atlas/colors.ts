import type { EntityManifest, FillMode } from "@/features/atlas/domain";
import type { PresetProgress } from "@/features/atlas/persistence-schema";

const groupHues: Record<string, number> = {
	Africa: 39,
	Asia: 102,
	Europe: 226,
	"North America": 184,
	"South America": 146,
	Oceania: 286,
	"br-north": 146,
	"br-northeast": 58,
	"br-central-west": 88,
	"br-southeast": 218,
	"br-south": 292,
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

export function stableHash(value: string) {
	let hash = 2_166_136_261;
	for (const character of value) {
		hash ^= character.codePointAt(0) ?? 0;
		hash = Math.imul(hash, 16_777_619);
	}
	return hash >>> 0;
}

export function isValidCustomColor(value: string) {
	return /^#[\da-f]{6}$/i.test(value);
}

function deterministicLightness(id: string) {
	return 57 + (stableHash(id) % 15);
}

export function getSelectedFill(
	entity: EntityManifest,
	mode: FillMode,
	progress: PresetProgress,
) {
	if (mode === "custom") {
		const custom = progress.customColors[entity.id];
		if (custom && isValidCustomColor(custom)) return custom;
	}
	if (mode === "chronology") {
		const order = progress.selected[entity.id]?.order ?? 1;
		const selectedCount = Math.max(1, Object.keys(progress.selected).length);
		const ratio = selectedCount === 1 ? 0.5 : (order - 1) / (selectedCount - 1);
		return `oklch(${(0.74 - ratio * 0.25).toFixed(3)} 0.12 39)`;
	}
	const hue = mode === "accent" ? 39 : (groupHues[entity.groupId] ?? 39);
	const lightness = deterministicLightness(entity.id);
	return `oklch(${(lightness / 100).toFixed(3)} 0.12 ${hue})`;
}
