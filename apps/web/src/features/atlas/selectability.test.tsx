import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AtlasSidebar } from "@/features/atlas/components/atlas-sidebar";
import {
	createDefaultState,
	createEmptyProgress,
	ORIGIN_STAMP,
} from "@/features/atlas/persistence-schema";
import { createSelectionPolicy } from "@/features/atlas/selection-policy";
import { useAtlasStore } from "@/features/atlas/store";
import { mixedManifest, mixedPreset } from "@/test/mixed-preset";

const policy = createSelectionPolicy(mixedManifest);

function seedMixedPreset() {
	const state = createDefaultState();
	state.presets.mixed = createEmptyProgress("mercator");
	useAtlasStore.setState({ data: state, hydrated: true, announcement: "" });
}

const mixedProgress = () => useAtlasStore.getState().data.presets.mixed;

beforeEach(seedMixedPreset);

describe("selectability is enforced everywhere", () => {
	it("lets keyboard users locate a non-selectable search result", async () => {
		const user = userEvent.setup();
		const locate = vi.fn();
		render(<AtlasSidebar preset={mixedPreset} onFocusEntity={locate} />);
		await user.type(screen.getByRole("searchbox"), "MX-TERRITORY");
		await user.keyboard("{ArrowDown}");
		expect(
			screen.getByRole("button", { name: "Locate MX-TERRITORY on map" }),
		).toHaveFocus();
		await user.keyboard("{Enter}");
		expect(locate).toHaveBeenCalledWith("mx-territory");
		expect(mixedProgress().selected).toEqual({});
	});

	it("renders a visible non-selectable region but does not let it be toggled", async () => {
		const user = userEvent.setup();
		render(
			<AtlasSidebar preset={mixedPreset} onFocusEntity={() => undefined} />,
		);

		const available = screen.getByRole("button", { name: /^MX-A/ });
		const unavailable = screen.getByRole("button", { name: /^MX-TERRITORY/ });
		expect(unavailable).toBeInTheDocument();
		expect(unavailable).toBeDisabled();
		// The unavailable state is not carried by colour alone.
		expect(unavailable).toHaveTextContent("Not counted");
		expect(unavailable).not.toHaveAttribute("aria-pressed");

		await user.click(unavailable);
		expect(mixedProgress().selected["mx-territory"]).toBeUndefined();

		await user.click(available);
		expect(mixedProgress().selected["mx-a"]).toBeDefined();
	});

	it("counts progress from the manifest total, not from what is stored", () => {
		render(
			<AtlasSidebar preset={mixedPreset} onFocusEntity={() => undefined} />,
		);
		expect(screen.getByRole("progressbar")).toHaveAttribute("max", "2");

		// A non-selectable ID that reached storage by another route must not count.
		useAtlasStore.setState((state) => ({
			data: {
				...state.data,
				presets: {
					...state.data.presets,
					mixed: {
						...state.data.presets.mixed,
						selected: {
							"mx-territory": {
								selectedAt: "2026-07-24T12:00:00.000Z",
								order: 1,
								stamp: ORIGIN_STAMP,
							},
						},
					},
				},
			},
		}));
		expect(screen.getByRole("progressbar")).toHaveAttribute("value", "0");
	});

	it("restricts a parent group to its selectable children", async () => {
		const user = userEvent.setup();
		render(
			<AtlasSidebar preset={mixedPreset} onFocusEntity={() => undefined} />,
		);
		await user.click(screen.getByText("Select groups"));

		// Three children in the manifest, two of them selectable.
		const group = screen.getByRole("checkbox", {
			name: /Group A, 0 of 2 selected/,
		});
		await user.click(group);

		expect(Object.keys(mixedProgress().selected).sort()).toEqual([
			"mx-a",
			"mx-b",
		]);
		expect(group).toBeChecked();
	});
});

describe("store actions refuse to bypass the policy", () => {
	it("ignores a direct toggle of a non-selectable entity", () => {
		useAtlasStore.getState().toggleEntity(policy, "mx-territory", "Territory");
		expect(mixedProgress().selected["mx-territory"]).toBeUndefined();
	});

	it("ignores a direct toggle of an entity the manifest never mentions", () => {
		useAtlasStore.getState().toggleEntity(policy, "mx-nowhere", "Nowhere");
		expect(mixedProgress().selected["mx-nowhere"]).toBeUndefined();
	});

	it("ignores a direct custom colour on a non-selectable entity", () => {
		useAtlasStore.getState().setCustomColor(policy, "mx-territory", "#123456");
		expect(mixedProgress().customColors["mx-territory"]).toBeUndefined();
	});

	it("selects only the selectable children through a direct parent call", () => {
		useAtlasStore.getState().setParent(policy, mixedManifest.parents[0], true);
		expect(Object.keys(mixedProgress().selected).sort()).toEqual([
			"mx-a",
			"mx-b",
		]);
	});

	it("removes a stored non-selectable ID and says why", () => {
		useAtlasStore.setState((state) => ({
			data: {
				...state.data,
				presets: {
					...state.data.presets,
					mixed: {
						...state.data.presets.mixed,
						selected: {
							"mx-a": {
								selectedAt: "2026-07-24T12:00:00.000Z",
								order: 1,
								stamp: ORIGIN_STAMP,
							},
							"mx-territory": {
								selectedAt: "2026-07-24T12:00:01.000Z",
								order: 2,
								stamp: ORIGIN_STAMP,
							},
							"mx-nowhere": {
								selectedAt: "2026-07-24T12:00:02.000Z",
								order: 3,
								stamp: ORIGIN_STAMP,
							},
						},
					},
				},
			},
		}));

		useAtlasStore.getState().sanitizePreset(policy);

		expect(Object.keys(mixedProgress().selected)).toEqual(["mx-a"]);
		const announcement = useAtlasStore.getState().announcement;
		expect(announcement).toContain("1 unknown saved region was ignored");
		expect(announcement).toContain("no longer selectable");
	});
});
