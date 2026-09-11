import { expect, type Page, test } from "@playwright/test";

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

test("navigates the region list by keyboard and exits it with one Tab", async ({
	page,
}) => {
	const search = page.getByRole("searchbox");
	// A region toggle is the only button that carries `data-selected`.
	const focusedRegion = page.locator("button[data-selected]:focus");

	await search.click();
	await page.keyboard.press("ArrowDown");
	await expect(focusedRegion).toHaveCount(1);

	// Walk far enough down that the active row starts outside the scroll viewport.
	for (let step = 0; step < 25; step += 1)
		await page.keyboard.press("ArrowDown");
	await expect(focusedRegion).toHaveCount(1);
	await expect(focusedRegion).toBeInViewport();

	// Enter activates the row that actually has focus, not the first search result.
	const activeName = (await focusedRegion.innerText()).split("\n")[0];
	await page.keyboard.press("Enter");
	await expect(page.getByRole("progressbar")).toHaveAttribute("value", "1");
	await expect(
		page.getByRole("button", { name: new RegExp(`^${activeName}`) }),
	).toHaveAttribute("aria-pressed", "true");

	// One Tab leaves the whole result set instead of walking the remaining regions.
	await page.keyboard.press("Tab");
	await expect(focusedRegion).toHaveCount(0);

	await page.keyboard.press("Shift+Tab");
	await page.keyboard.press("Escape");
	await expect(search).toBeFocused();
	await expect(search).toHaveValue("");
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
		.getByRole("button", { name: "Reset World" })
		.click();
	await expect(page.getByRole("progressbar")).toHaveAttribute("value", "0");

	await page.getByLabel("Import progress JSON").setInputFiles(exportPath);
	await expect(
		page.getByRole("heading", { name: "Review imported progress" }),
	).toBeVisible();
	await page.getByRole("button", { name: "Replace local data" }).click();
	await expect(page.getByRole("button", { name: /^Canada/ })).toHaveAttribute(
		"aria-pressed",
		"true",
	);
});

test("gives the safe action initial focus in a destructive dialog", async ({
	page,
}) => {
	await page.getByRole("searchbox").fill("france");
	await page.getByRole("searchbox").press("Enter");
	await openStyleAndData(page);

	// Open by keyboard: this is the path where an extra Enter could commit the deletion.
	const trigger = page.getByRole("button", { name: "Reset preset" });
	await trigger.focus();
	await trigger.press("Enter");

	const dialog = page.getByRole("dialog");
	await expect(dialog).toBeVisible();
	await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
	await expect(
		dialog.getByRole("button", { name: "Reset World" }),
	).not.toBeFocused();

	// So the very next Enter cancels rather than deletes.
	await page.keyboard.press("Enter");
	await expect(dialog).toBeHidden();
	await expect(page.getByRole("progressbar")).toHaveAttribute("value", "1");
	await expect(trigger).toBeFocused();

	// Escape leaves progress untouched too.
	await trigger.press("Enter");
	await expect(page.getByRole("dialog")).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("dialog")).toBeHidden();
	await expect(page.getByRole("progressbar")).toHaveAttribute("value", "1");
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

test("merges independent selections made in two tabs of one browser", async ({
	page,
	context,
}) => {
	const second = await context.newPage();
	await second.goto("/");
	await expect(
		second.getByRole("heading", { name: "World sovereign states" }),
	).toBeVisible();

	// Each tab selects a different region, neither having seen the other's choice.
	await page.getByRole("searchbox").fill("france");
	await page.getByRole("searchbox").press("Enter");
	await second.getByRole("searchbox").fill("spain");
	await second.getByRole("searchbox").press("Enter");

	// A reload is what makes each tab read the durable record the other one wrote.
	await page.reload();
	await second.reload();
	await expect(page.getByRole("progressbar")).toHaveAttribute("value", "2");
	await expect(second.getByRole("progressbar")).toHaveAttribute("value", "2");

	// Deselect in one tab while the other makes an unrelated edit.
	await page.getByRole("searchbox").fill("france");
	await page.getByRole("searchbox").press("Enter");
	await second.getByRole("searchbox").fill("portugal");
	await second.getByRole("searchbox").press("Enter");

	await page.reload();
	await second.reload();
	// France stays gone and Portugal survives: no resurrection, no loss.
	for (const tab of [page, second]) {
		await expect(tab.getByRole("progressbar")).toHaveAttribute("value", "2");
		await expect(tab.getByRole("button", { name: /^France/ })).toHaveAttribute(
			"aria-pressed",
			"false",
		);
		await expect(
			tab.getByRole("button", { name: /^Portugal/ }),
		).toHaveAttribute("aria-pressed", "true");
		await expect(tab.getByRole("button", { name: /^Spain/ })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
	}

	// A fresh page reads the same durable record.
	const third = await context.newPage();
	await third.goto("/");
	await expect(third.getByRole("progressbar")).toHaveAttribute("value", "2");
	await second.close();
	await third.close();
});

test("keeps zoom bounded and resets it when the projection changes", async ({
	page,
}) => {
	const group = page.locator('[data-testid="atlas-map"] > g').last();
	const scale = async () =>
		Number(
			/scale\(([\d.]+)\)/.exec(
				(await group.getAttribute("transform")) ?? "",
			)?.[1] ?? "1",
		);

	// Zoom well past the configured maximum through the control.
	const zoomIn = page.getByRole("button", { name: "Zoom in" });
	for (let step = 0; step < 12; step += 1) await zoomIn.click();
	expect(await scale()).toBeLessThanOrEqual(8);
	expect(await scale()).toBeGreaterThan(1);

	// Zooming out is bounded the same way.
	const zoomOut = page.getByRole("button", { name: "Zoom out" });
	for (let step = 0; step < 12; step += 1) await zoomOut.click();
	expect(await scale()).toBe(1);

	// A projection change resets the transform deterministically.
	for (let step = 0; step < 3; step += 1) await zoomIn.click();
	expect(await scale()).toBeGreaterThan(1);
	await page.getByLabel("Projection").selectOption("robinson");
	await expect.poll(scale).toBe(1);
});

test("keeps a selection made just before the viewport becomes unsupported", async ({
	page,
}) => {
	const search = page.getByRole("searchbox");
	await search.fill("portugal");
	await search.press("Enter");
	// Cross the threshold immediately, inside the write debounce window.
	await page.setViewportSize({ width: 900, height: 699 });
	await expect(
		page.getByRole("heading", { name: "Give the map more room" }),
	).toBeVisible();
	await page.setViewportSize({ width: 1280, height: 800 });

	await expect(page.getByRole("progressbar")).toHaveAttribute("value", "1");
	await expect(page.getByRole("button", { name: /^Portugal/ })).toHaveAttribute(
		"aria-pressed",
		"true",
	);

	await page.reload();
	await expect(page.getByRole("progressbar")).toHaveAttribute("value", "1");
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
	// The trigger is named by the current preference, not by a generic verb.
	await expect(
		page.getByRole("button", { name: "Appearance: System" }),
	).toBeVisible();

	await page.getByRole("button", { name: /^Appearance:/ }).click();
	const options = page.getByRole("menuitemradio");
	await expect(options).toHaveCount(3);
	await expect(
		page.getByRole("menuitemradio", { name: "System" }),
	).toHaveAttribute("aria-checked", "true");
	await page.getByRole("menuitemradio", { name: "Dark" }).click();
	await expect(page.locator("html")).toHaveClass(/dark/);
	await expect(
		page.getByRole("button", { name: "Appearance: Dark" }),
	).toBeVisible();
	const darkSurface = await page
		.getByTestId("atlas-map")
		.evaluate(
			(element) =>
				getComputedStyle(element.parentElement as HTMLElement).backgroundColor,
		);
	await page.getByRole("button", { name: /^Appearance:/ }).click();
	await page.getByRole("menuitemradio", { name: "Light" }).click();
	await expect(page.locator("html")).not.toHaveClass(/dark/);
	const lightSurface = await page
		.getByTestId("atlas-map")
		.evaluate(
			(element) =>
				getComputedStyle(element.parentElement as HTMLElement).backgroundColor,
		);
	expect(lightSurface).not.toBe(darkSurface);

	// Only the versioned record is written, and the preference survives a reload without flash.
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					JSON.parse(localStorage.getItem("atlas-tint:state") ?? "{}")
						.themePreference,
			),
		)
		.toBe("light");
	expect(
		await page.evaluate(() => localStorage.getItem("atlas-tint:theme")),
	).toBeNull();

	await page.reload();
	await expect(page.locator("html")).toHaveClass(/light/);
	await expect(
		page.getByRole("button", { name: "Appearance: Light" }),
	).toBeVisible();
});

test("adopts a pre-versioned appearance key once and then retires it", async ({
	page,
}) => {
	await page.evaluate(() => {
		localStorage.clear();
		localStorage.setItem("atlas-tint:theme", "dark");
	});
	await page.reload();

	// No flash: the pre-paint script reads the legacy key too.
	await expect(page.locator("html")).toHaveClass(/dark/);
	await expect(
		page.getByRole("button", { name: "Appearance: Dark" }),
	).toBeVisible();

	// One durable authority from now on.
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					JSON.parse(localStorage.getItem("atlas-tint:state") ?? "{}")
						.themePreference,
			),
		)
		.toBe("dark");
	await expect
		.poll(() => page.evaluate(() => localStorage.getItem("atlas-tint:theme")))
		.toBeNull();
});

test("names the selection-order mode and states its direction", async ({
	page,
}) => {
	await page.getByRole("searchbox").fill("france");
	await page.getByRole("searchbox").press("Enter");
	await openStyleAndData(page);

	const modes = page.getByLabel("Selected region color mode");
	await expect(modes).toContainText("Selection order");
	await expect(modes).not.toContainText("Visit chronology");
	await modes.selectOption("chronology");

	const legend = page.locator("footer");
	await expect(legend).toContainText("First marked");
	await expect(legend).toContainText("Most recently marked");

	// The direction is readable in both themes, because it is words, not only a gradient.
	for (const appearance of ["Dark", "Light"] as const) {
		await page.getByRole("button", { name: /^Appearance:/ }).click();
		await page.getByRole("menuitemradio", { name: appearance }).click();
		await expect(legend).toContainText("First marked");
		await expect(legend).toContainText("Most recently marked");
	}

	// Other fill modes keep the plain selected marker instead.
	await modes.selectOption("hierarchical");
	await expect(legend).toContainText("Selected");
	await expect(legend).not.toContainText("First marked");
});

test("keeps one shell geometry between loading and ready", async ({ page }) => {
	// Freeze the geometry request so the loading shell is observable.
	let release: () => void = () => undefined;
	const held = new Promise<void>((resolve) => {
		release = resolve;
	});
	await page.route("**/maps/*.topo.json*", async (route) => {
		await held;
		await route.continue();
	});

	await page.goto("/");
	const loading = page.getByRole("status", { name: "Loading map preset" });
	await expect(loading).toBeVisible();
	const loadingColumns = await loading.evaluate(
		(element) => getComputedStyle(element).gridTemplateColumns,
	);

	release();
	await expect(page.getByTestId("atlas-map")).toBeVisible();
	const readyColumns = await page
		.getByTestId("atlas-map")
		.evaluate(
			(element) =>
				getComputedStyle(element.closest("main")?.parentElement as HTMLElement)
					.gridTemplateColumns,
		);

	// The sidebar must not jump the moment the map finishes loading.
	expect(loadingColumns).toBe(readyColumns);
});

test("gives every control family the same visible focus treatment", async ({
	page,
}) => {
	await openStyleAndData(page);

	const outlineOf = (selector: string) =>
		page
			.locator(selector)
			.first()
			.evaluate((element) => {
				const style = getComputedStyle(element);
				return {
					width: style.outlineWidth,
					style: style.outlineStyle,
					offset: style.outlineOffset,
					color: style.outlineColor,
				};
			});

	const families: Array<[string, string]> = [
		["toolbar select", '[aria-label="Map preset"]'],
		["search input", '[role="searchbox"]'],
		[
			"button",
			'[data-slot="button"]:has(> svg + text), button[data-slot="button"]',
		],
		["region row", "#entity-results button[data-selected]"],
		["filter toggle", 'button[aria-pressed][class*="capitalize"]'],
		["summary", "details.settings-disclosure > summary"],
		["field select", '[aria-label="Selected region color mode"]'],
	];

	const measured: Array<{ width: string; style: string; offset: string }> = [];
	for (const [, selector] of families) {
		// Keyboard focus, so `:focus-visible` actually applies.
		await page.locator(selector).first().focus();
		await page.keyboard.press("Shift+Tab");
		await page.keyboard.press("Tab");
		const outline = await outlineOf(selector);
		measured.push(outline);
	}

	// Every family, one geometry.
	expect(
		measured.map(({ style, width, offset }) => `${style} ${width} ${offset}`),
	).toEqual(families.map(() => "solid 2px 2px"));

	// The file trigger focuses its hidden input, so its wrapper carries the ring instead.
	await page.getByLabel("Import progress JSON").focus();
	await expect
		.poll(async () =>
			page
				.locator("label:has(input[type=file])")
				.evaluate((element) => getComputedStyle(element).outlineStyle),
		)
		.toBe("solid");
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

test("shared controls follow motion roles and respect reduced motion", async ({
	page,
}) => {
	await openStyleAndData(page);
	const feedback = [
		page.getByRole("searchbox"),
		page.getByRole("button", { name: "Zoom in" }),
		page.getByLabel("Projection"),
		page.getByRole("button", { name: "Locate Algeria on map" }),
		page.getByText("Import", { exact: true }),
	];
	for (const control of feedback) {
		await expect(control).toHaveCSS("transition-duration", "0.12s");
		await expect(control).toHaveCSS(
			"transition-timing-function",
			"cubic-bezier(0.2, 0, 0, 1)",
		);
	}
	await page.getByRole("button", { name: /^Appearance:/ }).click();
	await expect(page.getByRole("menu")).toHaveCSS("animation-duration", "0.18s");
	await page.keyboard.press("Escape");
	await expect(page.getByRole("menu")).toHaveCount(0);
	await page.emulateMedia({ reducedMotion: "reduce" });
	for (const control of feedback) {
		await expect(control).toHaveCSS("transition-duration", "1e-05s");
	}
	await page.getByRole("button", { name: "Reset all", exact: true }).click();
	await expect(page.getByRole("dialog")).toHaveCSS(
		"animation-duration",
		"1e-05s",
	);
});
