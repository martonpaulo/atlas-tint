import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import {
	defaultCustomColor,
	getSelectedFill,
	resolveEntityColor,
} from "@/features/atlas/colors";
import { AtlasSidebar } from "@/features/atlas/components/atlas-sidebar";
import {
	createDefaultState,
	ORIGIN_STAMP,
} from "@/features/atlas/persistence-schema";
import { worldPreset } from "@/features/atlas/presets/world";
import { createSelectionPolicy } from "@/features/atlas/selection-policy";
import { useAtlasStore } from "@/features/atlas/store";

const policy = createSelectionPolicy(worldPreset.manifest);
const france = worldPreset.manifest.entities.find(
	({ id }) => id === "world-fr",
);
if (!france) throw new Error("France fixture missing");

function seedCustomMode(customColor?: string) {
	const state = createDefaultState();
	state.presets.world.fillMode = "custom";
	state.presets.world.selected["world-fr"] = {
		selectedAt: "2026-07-24T12:00:00.000Z",
		order: 1,
		stamp: ORIGIN_STAMP,
	};
	if (customColor) state.presets.world.customColors["world-fr"] = customColor;
	useAtlasStore.setState({ data: state, hydrated: true, announcement: "" });
}

const worldProgress = () => useAtlasStore.getState().data.presets.world;

const renderedFill = () =>
	resolveEntityColor(
		france,
		worldProgress().fillMode,
		worldProgress(),
		undefined,
		worldPreset.groupHues,
	);

beforeEach(() => seedCustomMode());

describe("custom color resolution", () => {
	it("reports an inherited color that equals what the map renders", () => {
		const resolved = renderedFill();
		expect(resolved.source).toBe("inherited");
		// The very disagreement the issue reported: the control claimed #b86b45 for this fill.
		expect(resolved.value).toBe(
			getSelectedFill(
				france,
				"custom",
				worldProgress(),
				undefined,
				worldPreset.groupHues,
			),
		);
		expect(resolved.value).not.toBe(defaultCustomColor);
		expect(resolved.value).toMatch(/^oklch\(/);
	});

	it("reports a saved color as custom", () => {
		seedCustomMode("#123abc");
		expect(renderedFill()).toEqual({ source: "custom", value: "#123abc" });
	});

	it("treats a malformed saved color as inherited rather than custom", () => {
		seedCustomMode("javascript:alert(1)");
		expect(renderedFill().source).toBe("inherited");
	});
});

describe("custom color control", () => {
	const renderSidebar = () =>
		render(
			<AtlasSidebar preset={worldPreset} onFocusEntity={() => undefined} />,
		);

	it("says the color is inherited before the first edit, and shows no picker", () => {
		renderSidebar();
		expect(
			screen.getByRole("button", {
				name: /Set a custom color for France, currently inherited/,
			}),
		).toBeInTheDocument();
		expect(
			screen.queryByLabelText("Custom color for France"),
		).not.toBeInTheDocument();
	});

	it("adopts the documented default when a custom color is set", async () => {
		const user = userEvent.setup();
		renderSidebar();

		await user.click(
			screen.getByRole("button", { name: /Set a custom color for France/ }),
		);

		expect(worldProgress().customColors["world-fr"]).toBe(defaultCustomColor);
		const picker = screen.getByLabelText("Custom color for France");
		// Control and map now agree, because both read the same decision.
		expect(picker).toHaveValue(defaultCustomColor);
		expect(renderedFill()).toEqual({
			source: "custom",
			value: defaultCustomColor,
		});
	});

	it("returns to the inherited color when the custom one is cleared", async () => {
		const user = userEvent.setup();
		seedCustomMode("#123abc");
		renderSidebar();
		expect(screen.getByLabelText("Custom color for France")).toHaveValue(
			"#123abc",
		);

		await user.click(
			screen.getByRole("button", {
				name: /Use the inherited color for France/,
			}),
		);

		expect(worldProgress().customColors["world-fr"]).toBeUndefined();
		expect(renderedFill().source).toBe("inherited");
		expect(
			screen.getByRole("button", { name: /currently inherited/ }),
		).toBeInTheDocument();
	});

	it("refuses a custom color that is not a #rrggbb value", () => {
		useAtlasStore.getState().setCustomColor(policy, "world-fr", "cornflower");
		expect(worldProgress().customColors["world-fr"]).toBeUndefined();
	});
});
