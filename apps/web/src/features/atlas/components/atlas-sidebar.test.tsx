import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AtlasSidebar } from "@/features/atlas/components/atlas-sidebar";
import {
	createDefaultState,
	ORIGIN_STAMP,
} from "@/features/atlas/persistence-schema";
import { spainPreset } from "@/features/atlas/presets/spain";
import { worldPreset } from "@/features/atlas/presets/world";
import { useAtlasStore } from "@/features/atlas/store";

beforeEach(() => {
	useAtlasStore.setState({
		data: createDefaultState(),
		hydrated: true,
		storageNotice: undefined,
		announcement: "",
	});
});

describe("AtlasSidebar", () => {
	it("selects from search with the keyboard and updates progress", async () => {
		const user = userEvent.setup();
		render(
			<AtlasSidebar
				manifest={worldPreset.manifest}
				onFocusEntity={() => undefined}
			/>,
		);
		const search = screen.getByRole("searchbox");
		await user.type(search, "france{Enter}");
		expect(
			useAtlasStore.getState().data.presets.world.selected["world-fr"],
		).toBeDefined();
		expect(screen.getByRole("progressbar")).toHaveAttribute("value", "1");
	});

	it("selects from the accessible list", async () => {
		const user = userEvent.setup();
		render(
			<AtlasSidebar
				manifest={worldPreset.manifest}
				onFocusEntity={() => undefined}
			/>,
		);
		await user.click(screen.getByRole("button", { name: /^Spain/ }));
		expect(
			useAtlasStore.getState().data.presets.world.selected["world-es"],
		).toBeDefined();
	});

	it("exposes a mixed Spanish parent after partially deselecting a child", async () => {
		const user = userEvent.setup();
		useAtlasStore.setState((state) => ({
			...state,
			data: { ...state.data, activePresetId: "spain" },
		}));
		render(
			<AtlasSidebar
				manifest={spainPreset.manifest}
				onFocusEntity={() => undefined}
			/>,
		);
		await user.click(screen.getByText("Select groups"));
		const group = screen.getByRole("checkbox", {
			name: /Andalusia, 0 of 8 selected/,
		});
		await user.click(group);
		expect(group).toBeChecked();
		await user.click(screen.getByRole("button", { name: /^Cádiz/ }));
		expect(group).toBePartiallyChecked();
	});

	it("requires confirmation before resetting current progress", async () => {
		const user = userEvent.setup();
		const state = createDefaultState();
		state.presets.world.selected["world-fr"] = {
			selectedAt: "2026-07-24T12:00:00.000Z",
			order: 1,
			stamp: ORIGIN_STAMP,
		};
		useAtlasStore.setState({ data: state });
		render(
			<AtlasSidebar
				manifest={worldPreset.manifest}
				onFocusEntity={() => undefined}
			/>,
		);
		await user.click(screen.getByText("Style & data"));
		await user.click(screen.getByRole("button", { name: "Reset preset" }));
		expect(
			screen.getByRole("heading", { name: "Reset World?" }),
		).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Reset World" }));
		expect(useAtlasStore.getState().data.presets.world.selected).toEqual({});
	});
});

describe("AtlasSidebar keyboard navigation", () => {
	const renderWorld = (onFocusEntity = () => undefined) =>
		render(
			<AtlasSidebar
				manifest={worldPreset.manifest}
				onFocusEntity={onFocusEntity}
			/>,
		);

	it("moves real DOM focus into the results and back to the search box", async () => {
		const user = userEvent.setup();
		renderWorld();
		const search = screen.getByRole("searchbox");

		await user.click(search);
		await user.keyboard("{ArrowDown}");
		const first = screen.getAllByRole("button", { name: /·/ })[0];
		expect(first).toHaveFocus();

		await user.keyboard("{ArrowDown}");
		expect(first).not.toHaveFocus();

		await user.keyboard("{ArrowUp}{ArrowUp}");
		expect(search).toHaveFocus();
	});

	it("keeps exactly one region control in the tab order", async () => {
		const user = userEvent.setup();
		renderWorld();
		const rows = screen.getAllByRole("button", { name: /·/ });
		expect(rows.filter((row) => row.tabIndex === 0)).toHaveLength(1);

		await user.click(screen.getByRole("searchbox"));
		await user.keyboard("{ArrowDown}{ArrowDown}");
		const stillOne = screen
			.getAllByRole("button", { name: /·/ })
			.filter((row) => row.tabIndex === 0);
		expect(stillOne).toHaveLength(1);
		expect(stillOne[0]).toHaveFocus();
	});

	it("never reports Locate as pressed while only navigating a search", async () => {
		const user = userEvent.setup();
		renderWorld();
		// A typed query is what used to conflate the search-active row with map focus.
		await user.type(screen.getByRole("searchbox"), "fra");
		await user.keyboard("{ArrowDown}{ArrowDown}");

		for (const locate of screen.getAllByRole("button", { name: /^Locate/ })) {
			expect(locate).toHaveAttribute("aria-pressed", "false");
		}
	});

	it("reports Locate as pressed once the map actually focuses the region", () => {
		render(
			<AtlasSidebar
				manifest={worldPreset.manifest}
				focusedEntityId="world-fr"
				onFocusEntity={() => undefined}
			/>,
		);
		expect(
			screen.getByRole("button", { name: "Locate France on map" }),
		).toHaveAttribute("aria-pressed", "true");
	});

	it("scrolls the active result into view when it would be offscreen", async () => {
		const user = userEvent.setup();
		const scrollIntoView = vi
			.spyOn(Element.prototype, "scrollIntoView")
			.mockImplementation(() => undefined);
		renderWorld();

		await user.click(screen.getByRole("searchbox"));
		await user.keyboard("{ArrowDown}{End}");

		expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
		scrollIntoView.mockRestore();
	});

	it("clears the search and returns focus with Escape from a result", async () => {
		const user = userEvent.setup();
		renderWorld();
		const search = screen.getByRole("searchbox");

		await user.type(search, "france");
		await user.keyboard("{ArrowDown}");
		await user.keyboard("{Escape}");

		expect(search).toHaveValue("");
		expect(search).toHaveFocus();
	});

	it("resets navigation when the result set changes under it", async () => {
		const user = userEvent.setup();
		renderWorld();
		const search = screen.getByRole("searchbox");

		await user.click(search);
		await user.keyboard("{ArrowDown}{ArrowDown}");
		await user.type(search, "spain");

		const rows = screen.getAllByRole("button", { name: /·/ });
		expect(rows.filter((row) => row.tabIndex === 0)).toHaveLength(1);
		expect(rows[0].tabIndex).toBe(0);
	});
});
