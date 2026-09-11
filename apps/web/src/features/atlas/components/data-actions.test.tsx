import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataActions } from "@/features/atlas/components/data-actions";
import legacyV1 from "@/features/atlas/fixtures/export-v1.json";
import legacyV2 from "@/features/atlas/fixtures/export-v2.json";
import { serializeAtlasExport } from "@/features/atlas/import-export";
import { importLimits } from "@/features/atlas/import-limits";
import {
	createDefaultState,
	ORIGIN_STAMP,
	type PersistedState,
} from "@/features/atlas/persistence-schema";
import { useAtlasStore } from "@/features/atlas/store";

function progressFile(name: string, mutate: (state: PersistedState) => void) {
	const state = createDefaultState();
	mutate(state);
	return new File(
		[serializeAtlasExport(state, new Date("2026-07-24T12:00:00.000Z"))],
		name,
		{ type: "application/json" },
	);
}

/** A file whose `text()` only resolves once released, so completion order is controllable. */
function withHeldText(file: File) {
	let release!: () => void;
	const held = new Promise<void>((resolve) => {
		release = resolve;
	});
	const contents = file.text.bind(file);
	Object.defineProperty(file, "text", {
		value: async () => {
			await held;
			return contents();
		},
	});
	return { file, release };
}

const selectFrance = (state: PersistedState) => {
	state.presets.world.selected["world-fr"] = {
		selectedAt: "2026-07-24T12:00:00.000Z",
		order: 1,
		stamp: ORIGIN_STAMP,
	};
};

const selectSpainAndBrazil = (state: PersistedState) => {
	state.presets.spain.selected["es-01"] = {
		selectedAt: "2026-07-24T12:00:00.000Z",
		order: 1,
		stamp: ORIGIN_STAMP,
	};
	state.presets.brazil.selected["br-ac"] = {
		selectedAt: "2026-07-24T12:00:01.000Z",
		order: 2,
		stamp: ORIGIN_STAMP,
	};
};

beforeEach(() => {
	useAtlasStore.setState({ data: createDefaultState() });
});

function renderActions() {
	render(<DataActions presetId="world" presetName="World" />);
	return {
		input: screen.getByLabelText("Import progress JSON"),
		section: screen.getByRole("region", { name: "Local data" }),
	};
}

describe("DataActions import limits", () => {
	it("rejects an oversized file without ever reading it", async () => {
		const user = userEvent.setup();
		const { input } = renderActions();
		const file = progressFile("huge.json", selectFrance);
		Object.defineProperty(file, "size", {
			value: importLimits.maxBytes + 1,
		});
		const text = vi.spyOn(file, "text");

		await user.upload(input, file);

		expect(await screen.findByRole("alert")).toHaveTextContent(
			/over the 1024 KB import limit/,
		);
		expect(text).not.toHaveBeenCalled();
		expect(
			screen.queryByRole("heading", { name: /review imported progress/i }),
		).not.toBeInTheDocument();
	});

	it("exposes a busy state while the file is being read", async () => {
		const user = userEvent.setup();
		const { input, section } = renderActions();
		const { file, release } = withHeldText(
			progressFile("progress.json", selectFrance),
		);

		await user.upload(input, file);

		expect(section).toHaveAttribute("aria-busy", "true");
		expect(
			screen.getByText("Reading the selected progress file."),
		).toBeInTheDocument();
		expect(input).toBeDisabled();

		release();
		await waitFor(() => expect(section).toHaveAttribute("aria-busy", "false"));
		expect(input).toBeEnabled();
	});

	it("lets only the latest choice publish a preview when they resolve out of order", async () => {
		const user = userEvent.setup();
		const { input } = renderActions();
		const slowFirst = withHeldText(progressFile("first.json", selectFrance));
		const fastSecond = withHeldText(
			progressFile("second.json", selectSpainAndBrazil),
		);

		await user.upload(input, slowFirst.file);
		// Disabling the chooser keeps this out of reach through the interface, so the second
		// choice is dispatched directly: the ordering guard has to hold on its own, for any path
		// that produces a selection while an earlier read is still in flight.
		input.removeAttribute("disabled");
		fireEvent.change(input, { target: { files: [fastSecond.file] } });

		fastSecond.release();
		await screen.findByRole("heading", { name: /review imported progress/i });
		slowFirst.release();

		// The earlier, slower file must not replace the preview the newer one produced.
		const afterImport = (scope: string) =>
			screen
				.getByRole("row", { name: new RegExp(`${scope} . Selected regions`) })
				.querySelectorAll("td")[1]?.textContent;
		await waitFor(() => expect(afterImport("Spain")).toContain("1 / 52"));
		expect(afterImport("Brazil")).toContain("1 / 27");
		expect(afterImport("World")).toContain("0 / 195");
	});
});

/** A fixture that moves every persisted category away from its default. */
function everyCategoryChanged(state: PersistedState) {
	state.activePresetId = "spain";
	state.themePreference = "dark";
	state.presets.world.selected["world-fr"] = {
		selectedAt: "2026-07-24T12:00:00.000Z",
		order: 1,
		stamp: ORIGIN_STAMP,
	};
	state.presets.world.customColors["world-fr"] = "#b86b45";
	state.presets.world.fillMode = "accent";
	state.presets.world.projection = "robinson";
	state.presets.brazil.fillMode = "chronology";
	state.presets.brazil.projection = "equal-earth";
	state.presets.spain.fillMode = "custom";
	state.presets.spain.projection = "natural-earth";
	state.presets.spain.customColors["es-01"] = "#334455";
	state.presets.spain.selected["es-01"] = {
		selectedAt: "2026-07-24T12:00:00.000Z",
		order: 1,
		stamp: ORIGIN_STAMP,
	};
}

async function openImportPreview(user: ReturnType<typeof userEvent.setup>) {
	const { input } = renderActions();
	await user.upload(input, progressFile("all.json", everyCategoryChanged));
	await screen.findByRole("heading", { name: /review imported progress/i });
	return input;
}

describe("DataActions destructive confirmation", () => {
	it("gives Cancel initial focus in the reset dialog", async () => {
		const user = userEvent.setup();
		render(<DataActions presetId="world" presetName="World" />);

		await user.click(screen.getByRole("button", { name: "Reset preset" }));
		const dialog = await screen.findByRole("dialog");

		await waitFor(() =>
			expect(
				within(dialog).getByRole("button", { name: "Cancel" }),
			).toHaveFocus(),
		);
		expect(
			within(dialog).getByRole("button", { name: "Reset World" }),
		).not.toHaveFocus();
	});

	it("gives Cancel initial focus in the import dialog", async () => {
		const user = userEvent.setup();
		await openImportPreview(user);
		const dialog = screen.getByRole("dialog");

		await waitFor(() =>
			expect(
				within(dialog).getByRole("button", { name: "Cancel" }),
			).toHaveFocus(),
		);
		expect(
			within(dialog).getByRole("button", { name: "Replace local data" }),
		).not.toHaveFocus();
	});

	it("names everything a preset reset changes and everything it keeps", async () => {
		const user = userEvent.setup();
		render(<DataActions presetId="world" presetName="World" />);
		await user.click(screen.getByRole("button", { name: "Reset preset" }));

		const description = await screen.findByText(/This removes selections/);
		expect(description).toHaveTextContent("custom colors");
		expect(description).toHaveTextContent("color mode");
		expect(description).toHaveTextContent("projection");
		expect(description).toHaveTextContent("stay unchanged");
	});

	it("names every category the import replaces", async () => {
		const user = userEvent.setup();
		await openImportPreview(user);

		const description = screen.getByText(/This import will replace/);
		for (const category of [
			"selections",
			"custom colors",
			"color modes",
			"projections",
			"active preset",
			"appearance preference",
		]) {
			expect(description).toHaveTextContent(category);
		}
	});

	it("shows a before and after value for every persisted category", async () => {
		const user = userEvent.setup();
		await openImportPreview(user);

		// Two application-wide rows plus four per preset, across three presets.
		const rows = screen.getAllByRole("row").slice(1);
		expect(rows).toHaveLength(2 + 3 * 4);

		const row = (name: RegExp) => screen.getByRole("row", { name });
		expect(row(/Application . Active preset/)).toHaveTextContent("World");
		expect(row(/Application . Active preset/)).toHaveTextContent("Spain");
		expect(row(/Application . Appearance/)).toHaveTextContent("Dark");
		expect(row(/World . Selected regions/)).toHaveTextContent("1 / 195");
		expect(row(/World . Custom colors/)).toHaveTextContent("1");
		expect(row(/World . Color mode/)).toHaveTextContent("Single accent");
		expect(row(/World . Projection/)).toHaveTextContent("Robinson");
		expect(row(/Brazil . Color mode/)).toHaveTextContent("Selection order");
		expect(row(/Spain . Projection/)).toHaveTextContent("Natural Earth");
		expect(screen.getByText(/settings would change/)).toBeInTheDocument();
	});

	it("changes nothing when the import dialog is cancelled", async () => {
		const user = userEvent.setup();
		await openImportPreview(user);

		await user.click(screen.getByRole("button", { name: "Cancel" }));

		expect(useAtlasStore.getState().data.activePresetId).toBe("world");
		expect(useAtlasStore.getState().data.presets.world.selected).toEqual({});
	});

	it("changes nothing when the import dialog is dismissed with Escape", async () => {
		const user = userEvent.setup();
		await openImportPreview(user);

		await user.keyboard("{Escape}");

		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
		expect(useAtlasStore.getState().data.activePresetId).toBe("world");
	});

	it("restores focus to the trigger when a reset is cancelled", async () => {
		const user = userEvent.setup();
		render(<DataActions presetId="world" presetName="World" />);
		const trigger = screen.getByRole("button", { name: "Reset preset" });

		await user.click(trigger);
		await user.click(await screen.findByRole("button", { name: "Cancel" }));

		await waitFor(() => expect(trigger).toHaveFocus());
		expect(useAtlasStore.getState().data.presets.world.selected).toEqual({});
	});
});

describe("historical import previews", () => {
	it.each([legacyV1, legacyV2])(
		"does not present schema $schemaVersion metadata as a product release",
		async (payload) => {
			const user = userEvent.setup();
			const { input } = renderActions();
			await user.upload(
				input,
				new File([JSON.stringify(payload)], "legacy.json", {
					type: "application/json",
				}),
			);
			await screen.findByRole("heading", { name: /review imported progress/i });
			expect(screen.getByRole("dialog")).not.toHaveTextContent(
				"AtlasTint 1.0.0",
			);
			await user.click(
				screen.getByRole("button", { name: "Replace local data" }),
			);
			expect(
				useAtlasStore.getState().data.presets.world.selected["world-ml"].order,
			).toBe(1);
		},
	);
});
