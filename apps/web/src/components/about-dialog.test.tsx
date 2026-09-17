import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AboutDialog, REPOSITORY_URL } from "@/components/about-dialog";

describe("AboutDialog", () => {
	it("names the project, its author, licence, and credits", async () => {
		const user = userEvent.setup();
		render(<AboutDialog />);
		await user.click(screen.getByRole("button", { name: "About AtlasTint" }));

		const dialog = await screen.findByRole("dialog", {
			name: "About AtlasTint",
		});
		expect(dialog).toHaveTextContent(/local-first interactive atlas/);
		expect(dialog).toHaveTextContent("Developed by Marton Paulo");
		expect(dialog).toHaveTextContent("MIT License");
		expect(dialog).toHaveTextContent(/local storage/);
		expect(
			within(dialog).getByRole("link", {
				name: "github.com/martonpaulo/atlastint",
			}),
		).toHaveAttribute("href", REPOSITORY_URL);
		expect(REPOSITORY_URL).toBe("https://github.com/martonpaulo/atlastint");
		for (const source of ["Natural Earth", "IBGE", "IGN/CNIG"])
			expect(within(dialog).getByRole("link", { name: source })).toBeVisible();
		for (const family of ["Source Serif 4", "Figtree", "Gabarito"])
			expect(within(dialog).getByRole("link", { name: family })).toBeVisible();
		// Continuous deployment: no user-visible release version.
		expect(dialog).not.toHaveTextContent(/version/i);
	});

	it("starts on Done, closes with Escape, and returns focus to the trigger", async () => {
		const user = userEvent.setup();
		render(<AboutDialog />);
		const trigger = screen.getByRole("button", { name: "About AtlasTint" });
		trigger.focus();
		await user.keyboard("{Enter}");
		await screen.findByRole("dialog");
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "Done" })).toHaveFocus(),
		);
		await user.keyboard("{Escape}");
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(trigger).toHaveFocus();
	});
});
