import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppearanceBridge, resolveAppearance } from "@/components/appearance";
import { ModeToggle } from "@/components/mode-toggle";
import {
	createPersistenceAdapter,
	LEGACY_THEME_KEY,
	serializePersistedState,
} from "@/features/atlas/persistence-adapter";
import {
	createDefaultState,
	STORAGE_KEY,
} from "@/features/atlas/persistence-schema";
import { resetAtlasPersistence, useAtlasStore } from "@/features/atlas/store";

function matchMediaReturning(dark: boolean) {
	const listeners = new Set<() => void>();
	vi.stubGlobal("matchMedia", (query: string) => ({
		matches: dark && query.includes("dark"),
		media: query,
		addEventListener: (_: string, listener: () => void) =>
			listeners.add(listener),
		removeEventListener: (_: string, listener: () => void) =>
			listeners.delete(listener),
	}));
	return {
		notify: () => {
			for (const listener of listeners) listener();
		},
	};
}

beforeEach(() => {
	window.localStorage.clear();
	document.documentElement.className = "";
	resetAtlasPersistence();
	useAtlasStore.setState({ data: createDefaultState(), hydrated: false });
});

afterEach(() => {
	vi.unstubAllGlobals();
	window.localStorage.clear();
});

describe("appearance authority", () => {
	it("resolves system through the media query and an explicit choice directly", () => {
		matchMediaReturning(true);
		expect(resolveAppearance("system")).toBe("dark");
		expect(resolveAppearance("light")).toBe("light");
		expect(resolveAppearance("dark")).toBe("dark");
	});

	it("applies the stored preference to the document", () => {
		matchMediaReturning(false);
		useAtlasStore.setState((state) => ({
			data: { ...state.data, themePreference: "dark" },
		}));
		render(<AppearanceBridge />);

		expect(document.documentElement).toHaveClass("dark");
		expect(document.documentElement).not.toHaveClass("light");
	});

	it("writes only the Atlas record when the preference changes", async () => {
		matchMediaReturning(false);
		const user = userEvent.setup();
		const stop = useAtlasStore.getState().initialize();
		render(
			<>
				<AppearanceBridge />
				<ModeToggle />
			</>,
		);

		await user.click(
			screen.getByRole("button", { name: "Appearance: System" }),
		);
		await user.click(
			await screen.findByRole("menuitemradio", { name: "Dark" }),
		);

		await vi.waitFor(() => {
			const stored = window.localStorage.getItem(STORAGE_KEY);
			expect(JSON.parse(stored ?? "{}").themePreference).toBe("dark");
		});
		// The second key is never written again.
		expect(window.localStorage.getItem(LEGACY_THEME_KEY)).toBeNull();
		stop();
	});

	it("names the trigger by the current preference", () => {
		matchMediaReturning(false);
		useAtlasStore.setState((state) => ({
			data: { ...state.data, themePreference: "light" },
		}));
		render(<ModeToggle />);
		expect(
			screen.getByRole("button", { name: "Appearance: Light" }),
		).toBeInTheDocument();
	});

	it("marks exactly one choice as selected in the open menu", async () => {
		matchMediaReturning(false);
		const user = userEvent.setup();
		useAtlasStore.setState((state) => ({
			data: { ...state.data, themePreference: "dark" },
		}));
		render(<ModeToggle />);

		await user.click(screen.getByRole("button", { name: "Appearance: Dark" }));
		const options = await screen.findAllByRole("menuitemradio");

		expect(options).toHaveLength(3);
		expect(
			options.filter(
				(option) => option.getAttribute("aria-checked") === "true",
			),
		).toHaveLength(1);
		expect(screen.getByRole("menuitemradio", { name: "Dark" })).toHaveAttribute(
			"aria-checked",
			"true",
		);
	});

	it("chooses each of the three options from the keyboard", async () => {
		matchMediaReturning(false);
		const user = userEvent.setup();
		const { unmount } = render(<ModeToggle />);

		for (const choice of ["Light", "Dark", "System"] as const) {
			// Open with the keyboard, not the pointer: this is the screen-reader path.
			screen.getByRole("button", { name: /^Appearance:/ }).focus();
			await user.keyboard("{Enter}");
			const option = await screen.findByRole("menuitemradio", { name: choice });
			option.focus();
			await user.keyboard("{Enter}");

			expect(useAtlasStore.getState().data.themePreference).toBe(
				choice.toLowerCase(),
			);
			await user.keyboard("{Escape}");
			await vi.waitFor(() =>
				expect(screen.queryByRole("menuitemradio")).not.toBeInTheDocument(),
			);
		}
		unmount();
	});
});

describe("legacy appearance key", () => {
	it("adopts the old key once when no Atlas record exists, then retires it", () => {
		window.localStorage.setItem(LEGACY_THEME_KEY, "dark");
		const adapter = createPersistenceAdapter(window.localStorage);

		const loaded = adapter.load();
		expect(loaded.state.themePreference).toBe("dark");

		expect(adapter.save(loaded.state)).toEqual({ ok: true });
		expect(window.localStorage.getItem(LEGACY_THEME_KEY)).toBeNull();
	});

	it("lets the Atlas record win when both keys exist", () => {
		const state = createDefaultState();
		state.themePreference = "light";
		window.localStorage.setItem(STORAGE_KEY, serializePersistedState(state));
		window.localStorage.setItem(LEGACY_THEME_KEY, "dark");

		expect(
			createPersistenceAdapter(window.localStorage).load().state
				.themePreference,
		).toBe("light");
	});

	it("ignores an unrecognised legacy value", () => {
		window.localStorage.setItem(LEGACY_THEME_KEY, "solarized");
		expect(
			createPersistenceAdapter(window.localStorage).load().state
				.themePreference,
		).toBe("system");
	});
});
