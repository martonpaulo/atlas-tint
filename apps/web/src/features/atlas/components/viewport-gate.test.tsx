import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it } from "vitest";

import { ViewportGate } from "@/features/atlas/components/viewport-gate";

function resize(width: number, height: number) {
	Object.defineProperties(window, {
		innerWidth: { configurable: true, value: width },
		innerHeight: { configurable: true, value: height },
	});
	act(() => window.dispatchEvent(new Event("resize")));
}

describe("ViewportGate", () => {
	it("blocks the workspace below the threshold and recovers on resize", () => {
		resize(900, 699);
		render(
			<ViewportGate>
				<div>Workspace mounted</div>
			</ViewportGate>,
		);
		expect(
			screen.getByRole("heading", { name: "Give the map more room" }),
		).toBeInTheDocument();
		expect(screen.queryByText("Workspace mounted")).not.toBeInTheDocument();
		// The small-window screen still credits the project, with external links only.
		expect(
			screen.getByText(/MIT licensed · © 2026 AtlasTint contributors\./),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Source" })).toHaveAttribute(
			"href",
			"https://github.com/martonpaulo/atlas-tint",
		);
		expect(
			screen.getByRole("link", { name: "martonpaulo.com" }),
		).toHaveAttribute("href", "https://martonpaulo.com/");
		resize(1024, 700);
		expect(screen.getByText("Workspace mounted")).toBeInTheDocument();
	});

	// index.html carries a static copy of this screen so a phone paints it before the bundle runs.
	// It must say what the component says.
	it("matches the static copy index.html paints before the bundle runs", () => {
		resize(900, 699);
		const { container } = render(
			<ViewportGate>
				<div>Workspace mounted</div>
			</ViewportGate>,
		);
		const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
		const staticNotice = new DOMParser()
			.parseFromString(html, "text/html")
			.querySelector("#viewport-notice");
		expect(staticNotice?.textContent).toBe(container.textContent);
	});
});
