import type { EntityManifest, FillMode } from "@/features/atlas/domain";
import type {
	PresetProgress,
	SelectionMetadata,
} from "@/features/atlas/persistence-schema";

/** The single-accent hue, and the last resort if a preset somehow renders an unmapped group. */
export const accentHue = 39;

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
	/** Supplied by the loaded preset; validated at load time, so every group has a hue. */
	groupHues: Readonly<Record<string, number>> = {},
) {
	if (mode === "custom") {
		const custom = progress.customColors[entity.id];
		if (custom && isValidCustomColor(custom)) return custom;
	}
	if (mode === "chronology") return chronologyFill(entity.id, chronology);
	// `accent` is one deliberate hue for every group; `hierarchical` uses the preset's own.
	const hue =
		mode === "accent" ? accentHue : (groupHues[entity.groupId] ?? accentHue);
	const lightness = deterministicLightness(entity.id);
	return `oklch(${(lightness / 100).toFixed(3)} 0.12 ${hue})`;
}
