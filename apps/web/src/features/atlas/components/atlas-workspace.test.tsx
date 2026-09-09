import { render, screen, waitFor } from "@testing-library/react";
import type { Geometry } from "geojson";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AtlasWorkspace } from "@/features/atlas/components/atlas-workspace";
import { type GeometryBundle, loadGeometry } from "@/features/atlas/geometry";
import {
	createDefaultState,
	ORIGIN_STAMP,
	STORAGE_KEY,
} from "@/features/atlas/persistence-schema";
import { worldPreset } from "@/features/atlas/presets/world";
import { createSelectionPolicy } from "@/features/atlas/selection-policy";
import { resetAtlasPersistence, useAtlasStore } from "@/features/atlas/store";

const worldPolicy = createSelectionPolicy(worldPreset.manifest);

vi.mock("@/features/atlas/geometry", async (importOriginal) => {
	const original =
		await importOriginal<typeof import("@/features/atlas/geometry")>();
	return { ...original, loadGeometry: vi.fn() };
});

const point: Geometry = { type: "Point", coordinates: [0, 0] };

function worldGeometry(): GeometryBundle {
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
		parents: { type: "FeatureCollection", features: [] },
	};
}

/** jsdom starts at 1024 × 768, which the gate supports. */
function resizeViewport(width: number, height: number) {
	act(() => {
		window.innerWidth = width;
		window.innerHeight = height;
		window.dispatchEvent(new Event("resize"));
	});
}

beforeEach(() => {
	vi.mocked(loadGeometry).mockResolvedValue(worldGeometry());
	window.localStorage.clear();
	resetAtlasPersistence();
	useAtlasStore.setState({
		data: createDefaultState(),
		hydrated: false,
		persistenceMode: "durable",
		incompatibleRecord: undefined,
		storageNotice: undefined,
		announcement: "",
	});
});

afterEach(() => {
	resizeViewport(1024, 768);
	vi.restoreAllMocks();
	window.localStorage.clear();
});

describe("AtlasWorkspace persistence lifecycle", () => {
	it("keeps a selection made just before the viewport becomes unsupported", async () => {
		vi.useFakeTimers();
		try {
			render(<AtlasWorkspace />);
			act(() => {
				useAtlasStore
					.getState()
					.toggleEntity(worldPolicy, "world-fr", "France");
			});

			// Cross below the threshold before the debounced write can run, then come back.
			resizeViewport(800, 600);
			expect(screen.getByText(/Give the map more room/i)).toBeInTheDocument();
			resizeViewport(1024, 768);

			expect(
				useAtlasStore.getState().data.presets.world.selected["world-fr"],
			).toBeDefined();

			act(() => vi.advanceTimersByTime(1_000));
			const stored = window.localStorage.getItem(STORAGE_KEY);
			expect(
				JSON.parse(stored ?? "{}").presets.world.selected["world-fr"],
			).toBeDefined();
		} finally {
			vi.useRealTimers();
		}
	});

	it("keeps session-only progress across an unsupported viewport", () => {
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new DOMException("Denied");
		});
		render(<AtlasWorkspace />);
		expect(useAtlasStore.getState().persistenceMode).toBe("session-only");

		act(() => {
			useAtlasStore.getState().toggleEntity(worldPolicy, "world-es", "Spain");
		});
		resizeViewport(800, 600);
		resizeViewport(1024, 768);

		expect(
			useAtlasStore.getState().data.presets.world.selected["world-es"],
		).toBeDefined();
		expect(useAtlasStore.getState().persistenceMode).toBe("session-only");
	});

	it("reads storage once however often the lifecycle initializes", async () => {
		render(<AtlasWorkspace />);
		await waitFor(() => expect(useAtlasStore.getState().hydrated).toBe(true));
		const getItem = vi.spyOn(Storage.prototype, "getItem");

		act(() => {
			useAtlasStore.getState().initialize();
			useAtlasStore.getState().initialize();
		});
		resizeViewport(800, 600);
		resizeViewport(1024, 768);

		expect(
			getItem.mock.calls.filter(([key]) => key === STORAGE_KEY),
		).toHaveLength(0);
	});

	it("registers one storage listener however often the lifecycle initializes", () => {
		const addEventListener = vi.spyOn(window, "addEventListener");
		render(<AtlasWorkspace />);
		act(() => {
			useAtlasStore.getState().initialize();
			useAtlasStore.getState().initialize();
		});

		expect(
			addEventListener.mock.calls.filter(([type]) => type === "storage"),
		).toHaveLength(1);
		expect(
			addEventListener.mock.calls.filter(([type]) => type === "pagehide"),
		).toHaveLength(1);
	});

	it("still receives cross-tab updates while the viewport is unsupported", () => {
		render(<AtlasWorkspace />);
		resizeViewport(800, 600);
		expect(screen.getByText(/Give the map more room/i)).toBeInTheDocument();

		const remote = createDefaultState();
		remote.presets.world.selected["world-pt"] = {
			selectedAt: "2026-07-24T12:00:00.000Z",
			order: 1,
			stamp: ORIGIN_STAMP,
		};
		act(() => {
			window.dispatchEvent(
				new StorageEvent("storage", {
					key: STORAGE_KEY,
					newValue: JSON.stringify(remote),
				}),
			);
		});

		// Persistence is owned above the gate, so a small window still tracks the other tab.
		expect(
			useAtlasStore.getState().data.presets.world.selected["world-pt"],
		).toBeDefined();
	});

	it("flushes pending durable intent when the application tears down", () => {
		vi.useFakeTimers();
		try {
			const { unmount } = render(<AtlasWorkspace />);
			act(() => {
				useAtlasStore
					.getState()
					.toggleEntity(worldPolicy, "world-fr", "France");
			});
			expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();

			unmount();

			const stored = window.localStorage.getItem(STORAGE_KEY);
			expect(
				JSON.parse(stored ?? "{}").presets.world.selected["world-fr"],
			).toBeDefined();
		} finally {
			vi.useRealTimers();
		}
	});
});
