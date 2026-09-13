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
});
