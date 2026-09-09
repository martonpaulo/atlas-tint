import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AtlasApp } from "@/features/atlas/components/atlas-app";
import { STORAGE_KEY } from "@/features/atlas/persistence-schema";
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
	window.localStorage.clear();
	useAtlasStore.setState({
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
		render(<AtlasApp />);
		expect(
			await screen.findByText(/could not read browser storage/i),
		).toBeInTheDocument();
	});
});

describe("AtlasApp persistence status", () => {
	it("says progress is saved locally while storage is durable", async () => {
		render(<AtlasApp />);
		expect(await screen.findByText("Saved locally")).toBeInTheDocument();
	});

	it("never claims progress is saved while a newer record blocks writes", async () => {
		window.localStorage.setItem(STORAGE_KEY, '{"schemaVersion":2}');
		render(<AtlasApp />);

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
		render(<AtlasApp />);
		expect(await screen.findByText("This session only")).toBeInTheDocument();
	});
});
