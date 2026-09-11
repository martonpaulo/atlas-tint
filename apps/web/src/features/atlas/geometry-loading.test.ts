import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const topology = {
	type: "Topology",
	arcs: [],
	objects: {
		entities: { type: "GeometryCollection", geometries: [] },
		parents: { type: "GeometryCollection", geometries: [] },
	},
};
const response = () => new Response(JSON.stringify(topology));

beforeEach(() => vi.resetModules());
afterEach(() => vi.restoreAllMocks());

describe("geometry loading", () => {
	it("reuses a successful versioned asset without another request", async () => {
		const fetch = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(response());
		const { loadGeometry } = await import("./geometry");
		const first = await loadGeometry("/world?v=1");
		expect(await loadGeometry("/world?v=1")).toBe(first);
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it("retains two recent assets and evicts the least recently used", async () => {
		const fetch = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async () => response());
		const { loadGeometry } = await import("./geometry");
		const world = await loadGeometry("/world?v=1");
		await loadGeometry("/brazil?v=1");
		expect(await loadGeometry("/world?v=1")).toBe(world);
		await loadGeometry("/spain?v=1");
		expect(await loadGeometry("/world?v=1")).toBe(world);
		await loadGeometry("/brazil?v=1");
		expect(fetch.mock.calls.map(([url]) => url)).toEqual([
			"/world?v=1",
			"/brazil?v=1",
			"/spain?v=1",
			"/brazil?v=1",
		]);
	});

	it("does not reuse geometry across asset versions", async () => {
		const fetch = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async () => response());
		const { loadGeometry } = await import("./geometry");
		await loadGeometry("/world?v=1");
		await loadGeometry("/world?v=2");
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it("retries after network and decoding failures", async () => {
		vi.spyOn(globalThis, "fetch")
			.mockRejectedValueOnce(new Error("Offline"))
			.mockResolvedValueOnce(new Response("{}"))
			.mockResolvedValueOnce(response());
		const { loadGeometry } = await import("./geometry");
		await expect(loadGeometry("/world?v=1")).rejects.toThrow("Offline");
		await expect(loadGeometry("/world?v=1")).rejects.toThrow(
			"geometry collections",
		);
		await expect(loadGeometry("/world?v=1")).resolves.toHaveProperty(
			"entities",
		);
	});

	it("rejects an aborted caller even when its asset is already cached", async () => {
		vi.spyOn(globalThis, "fetch").mockImplementation(async () => response());
		const { loadGeometry } = await import("./geometry");
		await loadGeometry("/world?v=1");
		const controller = new AbortController();
		controller.abort();
		await expect(
			loadGeometry("/world?v=1", controller.signal),
		).rejects.toMatchObject({ name: "AbortError" });
	});

	it("does not retain a load aborted while its response is being read", async () => {
		const controller = new AbortController();
		const abortedResponse = response();
		vi.spyOn(abortedResponse, "json").mockImplementation(async () => {
			controller.abort();
			return topology;
		});
		const fetch = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(abortedResponse)
			.mockResolvedValueOnce(response());
		const { loadGeometry } = await import("./geometry");
		await expect(
			loadGeometry("/world?v=1", controller.signal),
		).rejects.toMatchObject({ name: "AbortError" });
		await expect(loadGeometry("/world?v=1")).resolves.toHaveProperty(
			"entities",
		);
		expect(fetch).toHaveBeenCalledTimes(2);
	});
});
