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
		resize(1024, 700);
		expect(screen.getByText("Workspace mounted")).toBeInTheDocument();
	});
});
