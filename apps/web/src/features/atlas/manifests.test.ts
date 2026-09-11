import { describe, expect, it } from "vitest";

import { brazilPreset } from "@/features/atlas/presets/brazil";
import { spainPreset } from "@/features/atlas/presets/spain";
import { worldPreset } from "@/features/atlas/presets/world";

describe("curated manifest invariants", () => {
	it("keeps contextual World land visible without adding primary states", () => {
		const context = worldPreset.manifest.entities.filter(
			(entity) => !entity.selectable,
		);
		expect(context).toHaveLength(45);
		expect(context.map((entity) => entity.name)).toEqual(
			expect.arrayContaining([
				"Greenland",
				"Western Sahara",
				"Kosovo",
				"Taiwan",
				"Somaliland",
				"Northern Cyprus",
				"Puerto Rico",
				"Antarctica",
			]),
		);
	});
	it.each([
		[worldPreset.manifest, 195],
		[brazilPreset.manifest, 27],
		[spainPreset.manifest, 52],
	] as const)("matches configured primary totals for %s", (manifest, total) => {
		expect(
			manifest.entities.filter(({ selectable }) => selectable),
		).toHaveLength(total);
		expect(new Set(manifest.entities.map(({ id }) => id)).size).toBe(
			manifest.entities.length,
		);
		expect(
			new Set(manifest.entities.map(({ geometryId }) => geometryId)).size,
		).toBe(manifest.entities.length);
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
