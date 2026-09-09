import type { EntityManifest, FillMode } from "@/features/atlas/domain";
import type {
	PresetProgress,
	SelectionMetadata,
} from "@/features/atlas/persistence-schema";

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

/** The endpoints of the chronology scale: earliest is lightest, latest is darkest. */
const chronologyLightest = 0.74;
const chronologyDarkest = 0.49;

/**
 * Dense ranks for the entities that are selected *right now*.
 *
 * Stored `order` values are historical and stay sparse on purpose — deselecting the second of
 * three selections leaves 1 and 3, and history is worth more than a tidy sequence. But a colour
 * scale needs a position within the current set, and treating a stored order as that position
 * made the third selection render as if there were four, walking off the end of the scale and,
 * with a large enough gap, past black.
 *
 * Ranking is by stored order, then timestamp, then stable ID, so duplicate or imported orders
 * resolve the same way every time and the result never depends on render or manifest order.
 */
export interface ChronologyContext {
	rankById: ReadonlyMap<string, number>;
	count: number;
}

export function createChronologyContext(
	selected: Record<string, SelectionMetadata>,
): ChronologyContext {
	const entries = Object.entries(selected).sort(
		([leftId, left], [rightId, right]) =>
			left.order - right.order ||
			left.selectedAt.localeCompare(right.selectedAt) ||
			leftId.localeCompare(rightId),
	);
	return {
		rankById: new Map(entries.map(([id], rank) => [id, rank])),
		count: entries.length,
	};
}

export const emptyChronologyContext: ChronologyContext = {
	rankById: new Map(),
	count: 0,
};

export function chronologyFill(entityId: string, context: ChronologyContext) {
	const rank = context.rankById.get(entityId);
	// A single selection sits in the middle rather than at an arbitrary endpoint.
	const ratio =
		rank === undefined || context.count <= 1 ? 0.5 : rank / (context.count - 1);
	const bounded = Math.min(1, Math.max(0, ratio));
	const lightness =
		chronologyLightest - bounded * (chronologyLightest - chronologyDarkest);
	return `oklch(${lightness.toFixed(3)} 0.12 39)`;
}

export function getSelectedFill(
	entity: EntityManifest,
	mode: FillMode,
	progress: PresetProgress,
	chronology: ChronologyContext = emptyChronologyContext,
) {
	if (mode === "custom") {
		const custom = progress.customColors[entity.id];
		if (custom && isValidCustomColor(custom)) return custom;
	}
	if (mode === "chronology") return chronologyFill(entity.id, chronology);
	const hue = mode === "accent" ? 39 : (groupHues[entity.groupId] ?? 39);
	const lightness = deterministicLightness(entity.id);
	return `oklch(${(lightness / 100).toFixed(3)} 0.12 ${hue})`;
}
