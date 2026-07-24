import { describe, expect, it } from "vitest";

import {
	createAtlasExport,
	serializeAtlasExport,
	validateImportText,
} from "@/features/atlas/import-export";
import { brazilPreset } from "@/features/atlas/presets/brazil";
import { spainPreset } from "@/features/atlas/presets/spain";
import { worldPreset } from "@/features/atlas/presets/world";
import { createDefaultState } from "@/features/atlas/persistence-schema";

const manifests = {
	world: worldPreset.manifest,
	brazil: brazilPreset.manifest,
	spain: spainPreset.manifest,
};

describe("import and export", () => {
	it("creates a geometry-free, versioned export", () => {
		const exported = createAtlasExport(
			createDefaultState(),
			new Date("2026-07-24T12:00:00.000Z"),
		);
		expect(exported.schemaVersion).toBe(1);
		expect(exported.applicationVersion).toBe("1.0.0");
		expect(JSON.stringify(exported)).not.toContain("coordinates");
	});

	it("validates a round-trip and previews counts", () => {
		const state = createDefaultState();
		state.presets.world.selected["world-fr"] = {
			selectedAt: "2026-07-24T12:00:00.000Z",
			order: 1,
		};
		const result = validateImportText(
			serializeAtlasExport(state, new Date("2026-07-24T12:00:00.000Z")),
			manifests,
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(
				result.preview.presets.find(({ id }) => id === "world")?.selectedCount,
			).toBe(1);
		}
	});

	it("rejects invalid JSON and incompatible exports with actionable messages", () => {
		expect(validateImportText("not-json", manifests)).toEqual({
			ok: false,
			message: "The selected file is not valid JSON.",
		});
		const result = validateImportText(
			JSON.stringify({ format: "other" }),
			manifests,
		);
		expect(result.ok).toBe(false);
		if (!result.ok)
			expect(result.message).toContain("Invalid AtlasTint export");
	});
});
