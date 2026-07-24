import { describe, expect, it } from "vitest";

import { parseGeometryTopology } from "@/features/atlas/geometry";

describe("geometry boundaries", () => {
	it("rejects an asset with missing geometry collections", () => {
		expect(() =>
			parseGeometryTopology({ type: "Topology", arcs: [], objects: {} }),
		).toThrow("missing its expected geometry collections");
	});
});
