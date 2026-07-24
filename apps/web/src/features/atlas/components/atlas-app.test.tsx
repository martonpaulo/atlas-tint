import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AtlasApp } from "@/features/atlas/components/atlas-app";
import { useAtlasStore } from "@/features/atlas/store";

vi.mock("@/features/atlas/geometry", async (importOriginal) => {
	const original =
		await importOriginal<typeof import("@/features/atlas/geometry")>();
	return {
		...original,
		loadGeometry: vi.fn(async () => ({
			entities: { type: "FeatureCollection", features: [] },
			parents: { type: "FeatureCollection", features: [] },
		})),
	};
});

afterEach(() => {
	vi.restoreAllMocks();
	useAtlasStore.setState({ storageNotice: undefined });
});

describe("AtlasApp storage state", () => {
	it("shows a usable warning when browser storage cannot be read", async () => {
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new DOMException("Denied");
		});
		render(<AtlasApp />);
		expect(
			await screen.findByText(/could not read browser storage/i),
		).toBeInTheDocument();
	});
});
