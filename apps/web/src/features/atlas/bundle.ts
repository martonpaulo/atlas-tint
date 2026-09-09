import type { PresetManifest } from "@/features/atlas/domain";
import type { GeometryBundle } from "@/features/atlas/geometry";

/**
 * A manifest and a topology are separate artifacts fetched over separate requests, so they can
 * disagree: a cached topology from an older build, a hand-edited manifest, a partial deploy.
 * Rendering half a map is worse than refusing to, because a missing region silently changes
 * what the atlas claims is selectable.
 */
export type BundleMismatch =
	| { code: "missing-geometry"; ids: string[] }
	| { code: "unexpected-geometry"; ids: string[] }
	| { code: "geometry-id-mismatch"; ids: string[] }
	| { code: "group-mismatch"; ids: string[] }
	| { code: "missing-parent-boundary"; ids: string[] };

export type BundleValidation =
	| { ok: true }
	| { ok: false; mismatches: BundleMismatch[]; message: string };

const summaries: Record<BundleMismatch["code"], (count: number) => string> = {
	"missing-geometry": (count) =>
		`${count} region${count === 1 ? " has" : "s have"} no geometry`,
	"unexpected-geometry": (count) =>
		`${count} geometr${count === 1 ? "y is" : "ies are"} not in the region list`,
	"geometry-id-mismatch": (count) =>
		`${count} region${count === 1 ? "" : "s"} map to different source geometry`,
	"group-mismatch": (count) =>
		`${count} region${count === 1 ? "" : "s"} belong to a different group`,
	"missing-parent-boundary": (count) =>
		`${count} group${count === 1 ? " has" : "s have"} no boundary`,
};

/** At most this many IDs are named, so one broken deploy cannot produce an unreadable wall. */
const namedIdLimit = 5;

function describe(mismatch: BundleMismatch) {
	const named = mismatch.ids.slice(0, namedIdLimit).join(", ");
	const remainder = mismatch.ids.length - namedIdLimit;
	const suffix = remainder > 0 ? `, and ${remainder} more` : "";
	return `${summaries[mismatch.code](mismatch.ids.length)} (${named}${suffix})`;
}

export function validatePresetBundle(
	manifest: PresetManifest,
	geometry: GeometryBundle,
): BundleValidation {
	const entityProperties = new Map(
		geometry.entities.features.map(({ properties }) => [
			properties.id,
			properties,
		]),
	);
	const parentIds = new Set(
		geometry.parents.features.map(({ properties }) => properties.id),
	);

	const missingGeometry: string[] = [];
	const geometryIdMismatch: string[] = [];
	const groupMismatch: string[] = [];
	for (const entity of manifest.entities) {
		const properties = entityProperties.get(entity.id);
		if (!properties) {
			missingGeometry.push(entity.id);
			continue;
		}
		if (properties.geometryId !== entity.geometryId)
			geometryIdMismatch.push(entity.id);
		if (properties.groupId !== entity.groupId) groupMismatch.push(entity.id);
	}

	const manifestIds = new Set(manifest.entities.map(({ id }) => id));
	const unexpectedGeometry = [...entityProperties.keys()].filter(
		(id) => !manifestIds.has(id),
	);
	const missingParentBoundary = manifest.parents
		.map(({ id }) => id)
		.filter((id) => !parentIds.has(id));

	const mismatches: BundleMismatch[] = (
		[
			{ code: "missing-geometry", ids: missingGeometry },
			{ code: "unexpected-geometry", ids: unexpectedGeometry },
			{ code: "geometry-id-mismatch", ids: geometryIdMismatch },
			{ code: "group-mismatch", ids: groupMismatch },
			{ code: "missing-parent-boundary", ids: missingParentBoundary },
		] as const
	)
		.filter(({ ids }) => ids.length > 0)
		.map(({ code, ids }) => ({ code, ids }));

	if (mismatches.length === 0) return { ok: true };
	return {
		ok: false,
		mismatches,
		message: `The ${manifest.shortName} map data does not match its region list: ${mismatches
			.map(describe)
			.join(
				"; ",
			)}. The map asset is from a different build. Reload to fetch the current one.`,
	};
}
