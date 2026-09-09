import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { AtlasSidebar } from "@/features/atlas/components/atlas-sidebar";
import {
	createDefaultState,
	ORIGIN_STAMP,
} from "@/features/atlas/persistence-schema";
import { worldPreset } from "@/features/atlas/presets/world";
import { useAtlasStore } from "@/features/atlas/store";

function seed(selectFrance = false) {
	const state = createDefaultState();
	if (selectFrance)
		state.presets.world.selected["world-fr"] = {
			selectedAt: "2026-07-24T12:00:00.000Z",
			order: 1,
			stamp: ORIGIN_STAMP,
		};
	useAtlasStore.setState({ data: state, hydrated: true, announcement: "" });
}

const renderSidebar = () =>
	render(<AtlasSidebar preset={worldPreset} onFocusEntity={() => undefined} />);

const filterButton = (name: "all" | "selected") =>
	screen.getByRole("button", { name: new RegExp(`^${name}$`) });

beforeEach(() => seed());

describe("region filter state", () => {
	it("exposes exactly one active filter", async () => {
		const user = userEvent.setup();
		renderSidebar();

		expect(filterButton("all")).toHaveAttribute("aria-pressed", "true");
		expect(filterButton("selected")).toHaveAttribute("aria-pressed", "false");

		await user.click(filterButton("selected"));
		expect(filterButton("selected")).toHaveAttribute("aria-pressed", "true");
		expect(filterButton("all")).toHaveAttribute("aria-pressed", "false");
	});

	it("switches filters from the keyboard", async () => {
		const user = userEvent.setup();
		renderSidebar();

		filterButton("selected").focus();
		await user.keyboard("{Enter}");
		expect(filterButton("selected")).toHaveAttribute("aria-pressed", "true");

		filterButton("all").focus();
		await user.keyboard(" ");
		expect(filterButton("all")).toHaveAttribute("aria-pressed", "true");
	});

	it("announces the filter and result count once typing settles", async () => {
		const user = userEvent.setup();
		renderSidebar();

		await user.type(screen.getByRole("searchbox"), "france");
		// Six keystrokes must not produce six announcements.
		expect(screen.queryByText(/result for france/)).not.toBeInTheDocument();

		expect(
			await screen.findByText("All regions: 1 result for france.", undefined, {
				timeout: 2_000,
			}),
		).toBeInTheDocument();
	});
});

describe("empty region results explain themselves", () => {
	it("says nothing is selected yet, and offers a way to select something", async () => {
		const user = userEvent.setup();
		renderSidebar();

		await user.click(filterButton("selected"));

		expect(screen.getByText("No selected regions")).toBeInTheDocument();
		expect(
			screen.getByText("Choose All to find and mark a region."),
		).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Show all" }));
		expect(filterButton("all")).toHaveAttribute("aria-pressed", "true");
		expect(screen.getAllByRole("button", { name: /·/ }).length).toBeGreaterThan(
			0,
		);
	});

	it("says the query matched nothing, and offers to clear it", async () => {
		const user = userEvent.setup();
		renderSidebar();
		const search = screen.getByRole("searchbox");

		await user.type(search, "atlantis");

		expect(screen.getByText("No regions match the query")).toBeInTheDocument();
		expect(screen.getByText(/Nothing matches .atlantis./)).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Show all" }),
		).not.toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Clear search" }));
		expect(search).toHaveValue("");
	});

	it("distinguishes a query that fails inside the Selected view", async () => {
		const user = userEvent.setup();
		seed(true);
		renderSidebar();

		await user.click(filterButton("selected"));
		await user.type(screen.getByRole("searchbox"), "spain");

		expect(
			screen.getByText("No selected regions match the query"),
		).toBeInTheDocument();
		// Both recoveries are relevant here, and both are offered.
		expect(
			screen.getByRole("button", { name: "Clear search" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Show all" }),
		).toBeInTheDocument();
	});
});
