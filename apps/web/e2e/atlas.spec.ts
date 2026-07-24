import { expect, test, type Page } from "@playwright/test";

async function openCleanAtlas(page: Page) {
	await page.goto("/");
	await page.evaluate(() => localStorage.clear());
	await page.reload();
	await expect(
		page.getByRole("heading", { name: "World sovereign states" }),
	).toBeVisible();
	await expect(page.getByTestId("atlas-map")).toBeVisible();
}

async function selectPreset(page: Page, name: "World" | "Brazil" | "Spain") {
	await page.getByLabel("Map preset").selectOption({ label: name });
	const heading =
		name === "World"
			? "World sovereign states"
			: name === "Brazil"
				? "Brazilian federative units"
				: "Spanish provinces and autonomous cities";
	await expect(page.getByRole("heading", { name: heading })).toBeVisible();
}

async function openStyleAndData(page: Page) {
	await page.getByText("Style & data", { exact: true }).click();
}

test.beforeEach(async ({ page }) => {
	await openCleanAtlas(page);
});

test("selects a world entity directly on the SVG map", async ({ page }) => {
	await page.locator('[data-entity-id="world-ml"]').click();
	await expect(page.getByRole("button", { name: /^Mali/ })).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await expect(page.getByRole("progressbar")).toHaveAttribute("value", "1");
});

test("selects through keyboard search and retains progress after reload", async ({
	page,
}) => {
	const search = page.getByRole("searchbox");
	await search.fill("sao tome");
	await search.press("Enter");
	await expect(
		page.getByRole("button", { name: /^São Tomé and Príncipe/ }),
	).toHaveAttribute("aria-pressed", "true");
	await page.reload();
	await expect(
		page.getByRole("button", { name: /^São Tomé and Príncipe/ }),
	).toHaveAttribute("aria-pressed", "true");
});

test("keeps each preset progress isolated when switching", async ({ page }) => {
	await page.getByRole("button", { name: /^Spain/ }).click();
	await selectPreset(page, "Brazil");
	await page.getByRole("searchbox").fill("SP");
	await page.getByRole("searchbox").press("Enter");
	await expect(page.getByRole("progressbar")).toHaveAttribute("value", "1");
	await selectPreset(page, "World");
	await expect(page.getByRole("button", { name: /^Spain/ })).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await expect(page.getByRole("progressbar")).toHaveAttribute("value", "1");
});

test("changes world projection without losing selection and resets zoom", async ({
	page,
}) => {
	await page.getByRole("button", { name: /^Portugal/ }).click();
	await page.getByRole("button", { name: "Zoom in" }).click();
	await page.getByLabel("Projection").selectOption("robinson");
	await expect(page.getByRole("button", { name: /^Portugal/ })).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await expect(
		page.locator('svg g[transform="translate(0,0) scale(1)"]').first(),
	).toBeVisible();
});

test("selects a Spanish community and exposes mixed state after one province is removed", async ({
	page,
}) => {
	await selectPreset(page, "Spain");
	await page.getByText("Select groups", { exact: true }).click();
	const andalusia = page.getByRole("checkbox", {
		name: /Andalusia, 0 of 8 selected/,
	});
	await andalusia.check();
	await expect(page.getByRole("progressbar")).toHaveAttribute("value", "8");
	await page.getByRole("button", { name: /^Cádiz/ }).click();
	await expect(page.getByRole("progressbar")).toHaveAttribute("value", "7");
	const mixedAndalusia = page.getByRole("checkbox", {
		name: /Andalusia, 7 of 8 selected/,
	});
	await expect
		.poll(() =>
			mixedAndalusia.evaluate((input: HTMLInputElement) => input.indeterminate),
		)
		.toBe(true);
	await expect(page.getByText("Canary Islands · inset")).toBeVisible();
	await expect(page.getByText("Ceuta · inset")).toBeVisible();
	await expect(page.getByText("Melilla · inset")).toBeVisible();
});

test("exports, previews, and reimports progress atomically", async ({
	page,
}) => {
	await page.locator('[data-entity-id="world-ca"]').click();
	await openStyleAndData(page);
	const downloadPromise = page.waitForEvent("download");
	await page.getByRole("button", { name: "Export" }).click();
	const download = await downloadPromise;
	const exportPath = await download.path();
	if (!exportPath)
		throw new Error("Downloaded export did not have a local path");

	await page.getByRole("button", { name: "Reset preset" }).click();
	await page
		.getByRole("dialog")
		.getByRole("button", { name: "Reset preset" })
		.click();
	await expect(page.getByRole("progressbar")).toHaveAttribute("value", "0");

	await page.getByLabel("Import progress JSON").setInputFiles(exportPath);
	await expect(
		page.getByRole("heading", { name: "Review imported progress" }),
	).toBeVisible();
	await page.getByRole("button", { name: "Replace progress" }).click();
	await expect(page.getByRole("button", { name: /^Canada/ })).toHaveAttribute(
		"aria-pressed",
		"true",
	);
});

test("rejects an invalid import without changing progress", async ({
	page,
}) => {
	await openStyleAndData(page);
	await page.getByLabel("Import progress JSON").setInputFiles({
		name: "invalid.json",
		mimeType: "application/json",
		buffer: Buffer.from('{"format":"not-atlas-tint"}'),
	});
	await expect(page.getByRole("alert")).toContainText(
		"Invalid AtlasTint export",
	);
	await expect(page.getByRole("progressbar")).toHaveAttribute("value", "0");
});

test("shows the unsupported viewport screen and recovers automatically", async ({
	page,
}) => {
	await page.setViewportSize({ width: 900, height: 699 });
	await expect(
		page.getByRole("heading", { name: "Give the map more room" }),
	).toBeVisible();
	await expect(page.getByTestId("atlas-map")).toHaveCount(0);
	await page.setViewportSize({ width: 1280, height: 800 });
	await expect(page.getByTestId("atlas-map")).toBeVisible();
});

test("keeps the workspace usable at an effective 200% desktop zoom", async ({
	page,
}) => {
	// A 2048 × 1400 desktop at 200% browser zoom exposes a 1024 × 700 CSS viewport.
	await page.setViewportSize({ width: 1024, height: 700 });
	await expect(page.getByTestId("atlas-map")).toBeVisible();
	await expect(page.getByRole("searchbox")).toBeVisible();
	await expect(page.getByText("Style & data", { exact: true })).toBeVisible();
	const dimensions = await page.evaluate(() => ({
		clientHeight: document.documentElement.clientHeight,
		clientWidth: document.documentElement.clientWidth,
		scrollHeight: document.documentElement.scrollHeight,
		scrollWidth: document.documentElement.scrollWidth,
	}));
	expect(dimensions).toEqual({
		clientHeight: 700,
		clientWidth: 1024,
		scrollHeight: 700,
		scrollWidth: 1024,
	});
});

test("supports intentional light and dark themes", async ({ page }) => {
	const themeButton = page.getByRole("button", { name: "Toggle theme" });
	await themeButton.click();
	await page.getByRole("menuitem", { name: "Dark" }).click();
	await expect(page.locator("html")).toHaveClass(/dark/);
	const darkSurface = await page
		.getByTestId("atlas-map")
		.evaluate(
			(element) =>
				getComputedStyle(element.parentElement as HTMLElement).backgroundColor,
		);
	await themeButton.click();
	await page.getByRole("menuitem", { name: "Light" }).click();
	await expect(page.locator("html")).not.toHaveClass(/dark/);
	const lightSurface = await page
		.getByTestId("atlas-map")
		.evaluate(
			(element) =>
				getComputedStyle(element.parentElement as HTMLElement).backgroundColor,
		);
	expect(lightSurface).not.toBe(darkSurface);
});

test("respects reduced motion", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	const duration = await page
		.locator('[data-entity-id="world-fr"]')
		.evaluate((element) => getComputedStyle(element).transitionDuration);
	expect(
		duration.split(",").every((value) => Number.parseFloat(value) <= 0.00001),
	).toBe(true);
});
