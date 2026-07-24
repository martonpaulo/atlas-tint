import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { AtlasSidebar } from "@/features/atlas/components/atlas-sidebar";
import { spainPreset } from "@/features/atlas/presets/spain";
import { worldPreset } from "@/features/atlas/presets/world";
import { createDefaultState } from "@/features/atlas/persistence-schema";
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
		await user.click(screen.getByRole("button", { name: "Reset preset" }));
		expect(useAtlasStore.getState().data.presets.world.selected).toEqual({});
	});
});
