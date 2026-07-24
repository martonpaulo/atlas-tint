import { describe, expect, it } from "vitest";

import { brazilPreset } from "@/features/atlas/presets/brazil";
import { spainPreset } from "@/features/atlas/presets/spain";
import { worldPreset } from "@/features/atlas/presets/world";
import { normalizeSearchText, searchEntities } from "@/features/atlas/search";

describe("search", () => {
	it("normalizes Unicode, diacritics, punctuation, case, and whitespace", () => {
		expect(normalizeSearchText("  Côte—D’IVOIRE  ")).toBe("cote divoire");
		expect(normalizeSearchText("São   Tomé")).toBe("sao tome");
	});

	it("ranks exact canonical and code matches before broader matches", () => {
		const results = searchEntities(worldPreset.manifest.entities, "CG");
		expect(results[0]?.id).toBe("world-cg");
		expect(
			searchEntities(worldPreset.manifest.entities, "congo")
				.map(({ id }) => id)
				.slice(0, 2),
		).toEqual(["world-cg", "world-cd"]);
	});

	it("finds aliases, parent context, local names, and abbreviations", () => {
		expect(
			searchEntities(worldPreset.manifest.entities, "Ivory Coast")[0]?.id,
		).toBe("world-ci");
		expect(searchEntities(brazilPreset.manifest.entities, "SP")[0]?.name).toBe(
			"São Paulo",
		);
		expect(
			searchEntities(brazilPreset.manifest.entities, "sao paulo")[0]?.id,
		).toBe("br-sp");
		expect(
			searchEntities(spainPreset.manifest.entities, "Catalunya").map(
				({ id }) => id,
			),
		).toContain("es-08");
		expect(
			searchEntities(spainPreset.manifest.entities, "Guipuzcoa")[0]?.id,
		).toBe("es-20");
	});
});
