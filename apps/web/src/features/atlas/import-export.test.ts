import { describe, expect, it } from "vitest";
import legacyV1 from "@/features/atlas/fixtures/export-v1.json";
import legacyV2 from "@/features/atlas/fixtures/export-v2.json";

import {
	createAtlasExport,
	serializeAtlasExport,
	validateImportText,
} from "@/features/atlas/import-export";
import { importLimits } from "@/features/atlas/import-limits";
import {
	createDefaultState,
	createEmptyProgress,
	ORIGIN_STAMP,
	type PersistedState,
} from "@/features/atlas/persistence-schema";
import { brazilPreset } from "@/features/atlas/presets/brazil";
import { spainPreset } from "@/features/atlas/presets/spain";
import { worldPreset } from "@/features/atlas/presets/world";

const manifests = {
	world: worldPreset.manifest,
	brazil: brazilPreset.manifest,
	spain: spainPreset.manifest,
};

describe("import and export", () => {
	it("does not import contextual land as selected progress", () => {
		const state = createDefaultState();
		state.presets.world.selected["world-gl"] = {
			selectedAt: "2026-09-01T00:00:00.000Z",
			order: 1,
			stamp: ORIGIN_STAMP,
		};
		state.presets.world.customColors["world-gl"] = "#112233";
		const result = validateImportText(serializeAtlasExport(state), manifests);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.preview.state.presets.world.selected).not.toHaveProperty(
				"world-gl",
			);
			expect(
				result.preview.state.presets.world.customColors,
			).not.toHaveProperty("world-gl");
			expect(
				result.preview.presets.find((p) => p.id === "world")?.selectedCount,
			).toBe(0);
		}
	});
	it.each([legacyV1, legacyV2])(
		"imports historical export schema $schemaVersion",
		(payload) => {
			const result = validateImportText(JSON.stringify(payload), manifests);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(
					result.preview.state.presets.world.selected["world-ml"].order,
				).toBe(1);
				expect(result.preview).not.toHaveProperty("applicationVersion");
			}
		},
	);

	it("rejects a future export schema with its field path", () => {
		const result = validateImportText(
			JSON.stringify({ ...legacyV2, schemaVersion: 99 }),
			manifests,
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.message).toContain("schemaVersion");
	});

	it("rejects a future progress schema independently of the envelope", () => {
		const payload = {
			...legacyV2,
			state: { ...legacyV2.state, schemaVersion: 99 },
		};
		const result = validateImportText(JSON.stringify(payload), manifests);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.message).toContain("at state");
	});
	it("creates a geometry-free, versioned export", () => {
		const exported = createAtlasExport(
			createDefaultState(),
			new Date("2026-07-24T12:00:00.000Z"),
		);
		expect(exported.schemaVersion).toBe(3);
		expect(exported).not.toHaveProperty("applicationVersion");
		expect(JSON.stringify(exported)).not.toContain("coordinates");
	});

	it("validates a round-trip and previews counts", () => {
		const state = createDefaultState();
		state.presets.world.selected["world-fr"] = {
			selectedAt: "2026-07-24T12:00:00.000Z",
			order: 1,
			stamp: ORIGIN_STAMP,
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

describe("import limits", () => {
	const exportText = (state: PersistedState) =>
		serializeAtlasExport(state, new Date("2026-07-24T12:00:00.000Z"));

	function selections(count: number) {
		return Object.fromEntries(
			Array.from({ length: count }, (_, index) => [
				`world-${index}`,
				{
					selectedAt: "2026-07-24T12:00:00.000Z",
					order: index + 1,
					stamp: ORIGIN_STAMP,
				},
			]),
		);
	}

	it("round-trips a complete export of every catalog entity", () => {
		const state = createDefaultState();
		let order = 0;
		for (const [id, manifest] of Object.entries(manifests)) {
			state.presets[id].selected = Object.fromEntries(
				manifest.entities
					.filter((entity) => entity.selectable)
					.map((entity) => [
						entity.id,
						{
							selectedAt: "2026-07-24T12:00:00.000Z",
							order: ++order,
							stamp: ORIGIN_STAMP,
						},
					]),
			);
			state.presets[id].customColors = Object.fromEntries(
				manifest.entities
					.filter((entity) => entity.selectable)
					.map((entity) => [entity.id, "#b86b45"]),
			);
		}
		const text = exportText(state);
		const result = validateImportText(text, manifests);

		expect(result.ok).toBe(true);
		// The limit is headroom over a complete file, not a product ceiling.
		expect(new TextEncoder().encode(text).byteLength).toBeLessThan(
			importLimits.maxBytes,
		);
		expect(order).toBe(274);
	});

	it("rejects a payload over the byte limit before parsing it", () => {
		const oversized = `${" ".repeat(importLimits.maxBytes + 1)}{}`;
		const result = validateImportText(oversized, manifests);

		expect(result).toEqual({
			ok: false,
			message: expect.stringContaining("over the 1024 KB import limit"),
		});
	});

	it("accepts the largest selection record and rejects one entry more", () => {
		const atLimit = createDefaultState();
		atLimit.presets.world.selected = selections(importLimits.maxSelections);
		expect(validateImportText(exportText(atLimit), manifests).ok).toBe(true);

		const overLimit = createDefaultState();
		overLimit.presets.world.selected = selections(
			importLimits.maxSelections + 1,
		);
		const result = validateImportText(exportText(overLimit), manifests);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.message).toContain("presets.world.selected");
		expect(result.message).toContain("at most 2000");
	});

	it("rejects an entity key longer than the limit", () => {
		const state = createDefaultState();
		state.presets.world.selected["w".repeat(importLimits.maxKeyLength + 1)] = {
			selectedAt: "2026-07-24T12:00:00.000Z",
			order: 1,
			stamp: ORIGIN_STAMP,
		};
		const result = validateImportText(exportText(state), manifests);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.message).toContain("presets.world.selected");
	});

	it("rejects a custom color that is not a #rrggbb value", () => {
		const state = createDefaultState();
		state.presets.world.customColors["world-fr"] = "javascript:alert(1)";
		const result = validateImportText(exportText(state), manifests);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.message).toContain("#rrggbb");
	});

	it("bounds unknown preset records so they cannot retain unbounded state", () => {
		const withinLimit = createDefaultState();
		for (let index = 0; index < importLimits.maxPresets - 3; index += 1)
			withinLimit.presets[`future-${index}`] = {
				...createEmptyProgress("mercator"),
			};
		expect(validateImportText(exportText(withinLimit), manifests).ok).toBe(
			true,
		);

		const overLimit = createDefaultState();
		for (let index = 0; index < importLimits.maxPresets; index += 1)
			overLimit.presets[`future-${index}`] = {
				...createEmptyProgress("mercator"),
			};
		const result = validateImportText(exportText(overLimit), manifests);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.message).toContain("at most 32 preset records");
	});

	it("bounds an unknown preset's own records too", () => {
		const state = createDefaultState();
		state.presets.future = {
			...createEmptyProgress("mercator"),
			selected: selections(importLimits.maxSelections + 1),
		};
		const result = validateImportText(exportText(state), manifests);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.message).toContain("presets.future.selected");
	});
});
