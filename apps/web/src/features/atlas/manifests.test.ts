import { describe, expect, it } from "vitest";

import { brazilPreset } from "@/features/atlas/presets/brazil";
import { spainPreset } from "@/features/atlas/presets/spain";
import { worldPreset } from "@/features/atlas/presets/world";

describe("curated manifest invariants", () => {
	it.each([
		[worldPreset.manifest, 195],
		[brazilPreset.manifest, 27],
		[spainPreset.manifest, 52],
	] as const)("matches configured primary totals for %s", (manifest, total) => {
		expect(
			manifest.entities.filter(({ selectable }) => selectable),
		).toHaveLength(total);
		expect(new Set(manifest.entities.map(({ id }) => id)).size).toBe(total);
		expect(
			new Set(manifest.entities.map(({ geometryId }) => geometryId)).size,
		).toBe(total);
	});

	it("represents Spain's 17 communities and two autonomous cities", () => {
		expect(spainPreset.manifest.parents).toHaveLength(19);
		expect(
			spainPreset.manifest.entities.find(({ id }) => id === "es-35")?.inset,
		).toBe("canary");
		expect(
			spainPreset.manifest.entities.find(({ id }) => id === "es-38")?.inset,
		).toBe("canary");
		expect(spainPreset.manifest.entities.map(({ id }) => id)).toEqual(
			expect.arrayContaining(["es-07", "es-51", "es-52"]),
		);
	});
});
