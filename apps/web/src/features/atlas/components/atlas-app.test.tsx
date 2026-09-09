import { render, screen } from "@testing-library/react";
import type { Geometry } from "geojson";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AtlasWorkspace } from "@/features/atlas/components/atlas-workspace";
import { type GeometryBundle, loadGeometry } from "@/features/atlas/geometry";
import { STORAGE_KEY } from "@/features/atlas/persistence-schema";
import { worldPreset } from "@/features/atlas/presets/world";
import { resetAtlasPersistence, useAtlasStore } from "@/features/atlas/store";

const point: Geometry = { type: "Point", coordinates: [0, 0] };

const emptyGeometry: GeometryBundle = {
	entities: { type: "FeatureCollection", features: [] },
	parents: { type: "FeatureCollection", features: [] },
};

/** Geometry that agrees with the world manifest, which is what a matching build ships. */
function matchingWorldGeometry(): GeometryBundle {
	return {
		entities: {
			type: "FeatureCollection",
			features: worldPreset.manifest.entities.map(
				({ id, geometryId, groupId }) => ({
					type: "Feature",
					geometry: point,
					properties: { id, geometryId, groupId, inset: null },
				}),
			),
		},
		parents: {
			type: "FeatureCollection",
			features: worldPreset.manifest.parents.map(({ id }) => ({
				type: "Feature",
				geometry: point,
				properties: { id, inset: null },
			})),
		},
	};
}

vi.mock("@/features/atlas/geometry", async (importOriginal) => {
	const original =
		await importOriginal<typeof import("@/features/atlas/geometry")>();
	return { ...original, loadGeometry: vi.fn() };
});

beforeEach(() => {
	vi.mocked(loadGeometry).mockResolvedValue(matchingWorldGeometry());
});

afterEach(() => {
	vi.restoreAllMocks();
	window.localStorage.clear();
	resetAtlasPersistence();
	useAtlasStore.setState({
		hydrated: false,
		persistenceMode: "durable",
		incompatibleRecord: undefined,
		storageNotice: undefined,
	});
});

describe("AtlasApp storage state", () => {
	it("shows a usable warning when browser storage cannot be read", async () => {
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new DOMException("Denied");
		});
		render(<AtlasWorkspace />);
		expect(
			await screen.findByText(/could not read browser storage/i),
		).toBeInTheDocument();
	});
});

describe("AtlasApp persistence status", () => {
	it("says progress is saved locally while storage is durable", async () => {
		render(<AtlasWorkspace />);
		expect(await screen.findByText("Saved locally")).toBeInTheDocument();
	});

	it("never claims progress is saved while a newer record blocks writes", async () => {
		window.localStorage.setItem(STORAGE_KEY, '{"schemaVersion":99}');
		render(<AtlasWorkspace />);

		expect(await screen.findByText("Saved data locked")).toBeInTheDocument();
		expect(screen.queryByText("Saved locally")).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /download saved file/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /replace it/i }),
		).toBeInTheDocument();
	});

	it("says the session is not durable when storage is unavailable", async () => {
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new DOMException("Denied");
		});
		render(<AtlasWorkspace />);
		expect(await screen.findByText("This session only")).toBeInTheDocument();
	});
});

describe("AtlasApp bundle compatibility", () => {
	it("refuses to render a map whose geometry does not match the region list", async () => {
		vi.mocked(loadGeometry).mockResolvedValue(emptyGeometry);
		render(<AtlasWorkspace />);

		expect(
			await screen.findByRole("heading", { name: /did not load/i }),
		).toBeInTheDocument();
		expect(
			screen.getByText(/does not match its region list/i),
		).toBeInTheDocument();
		expect(screen.getByText(/different build/i)).toBeInTheDocument();
	});

	it("renders the workspace when both artifacts agree", async () => {
		render(<AtlasWorkspace />);
		expect(
			await screen.findByRole("heading", { name: worldPreset.manifest.name }),
		).toBeInTheDocument();
	});
});
