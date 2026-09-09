import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataActions } from "@/features/atlas/components/data-actions";
import { serializeAtlasExport } from "@/features/atlas/import-export";
import { importLimits } from "@/features/atlas/import-limits";
import {
	createDefaultState,
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
	};
};

const selectSpainAndBrazil = (state: PersistedState) => {
	state.presets.spain.selected["es-01"] = {
		selectedAt: "2026-07-24T12:00:00.000Z",
		order: 1,
	};
	state.presets.brazil.selected["br-ac"] = {
		selectedAt: "2026-07-24T12:00:01.000Z",
		order: 2,
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
		await waitFor(() =>
			expect(screen.getByText("Spain").nextSibling).toHaveTextContent("1 / 52"),
		);
		expect(screen.getByText("Brazil").nextSibling).toHaveTextContent("1 / 27");
		expect(screen.getByText("World").nextSibling).toHaveTextContent("0 / 195");
	});
});
