import { describe, expect, it } from "vitest";

import { geometryUrl } from "@/features/atlas/geometry-version";
import { spainPreset } from "@/features/atlas/presets/spain";
import { worldPreset } from "@/features/atlas/presets/world";

describe("content-versioned geometry requests", () => {
	it("binds every preset request to the committed topology digest", () => {
		for (const preset of [worldPreset, spainPreset]) {
			expect(preset.geometryUrl).toMatch(
				new RegExp(
					`maps/${preset.manifest.id}\\.topo\\.json\\?v=[0-9a-f]{12}$`,
				),
			);
		}
		expect(geometryUrl("world")).not.toBe(geometryUrl("spain"));
	});

	it("refuses a preset with no generated geometry version", () => {
		expect(() => geometryUrl("atlantis")).toThrow(/pnpm geo:build/);
	});
});
