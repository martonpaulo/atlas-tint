import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

import { chromium } from "@playwright/test";

/**
 * Render the 1200 by 630 social card.
 *
 * Unlike the README screenshots this one is rendered offscreen on purpose: a social card is a
 * flat graphic inside someone else's card frame, so there is no window shadow or corner to
 * preserve, and offscreen rendering is reproducible on any machine and in CI. It is captured at
 * device scale 2 and written at the exact 1200 by 630 the platforms expect.
 */

const outputDirectory = resolve(import.meta.dirname, "../../apps/web/public");
const card = { width: 1200, height: 630 };

const seed = {
	preset: "world",
	theme: "dark",
	marked: [
		"world-br",
		"world-pt",
		"world-es",
		"world-jp",
		"world-au",
		"world-ca",
		"world-za",
		"world-in",
	],
};

const STORAGE_KEY = "atlas-tint:state";
const ORIGIN_STAMP = { counter: 0, actor: "" };
const defaultProjections = {
	world: "equal-earth",
	brazil: "mercator",
	spain: "mercator",
};

function emptyProgress(projection) {
	return {
		selected: {},
		removed: {},
		fillMode: "hierarchical",
		customColors: {},
		projection,
		stamps: {
			fillMode: ORIGIN_STAMP,
			projection: ORIGIN_STAMP,
			customColors: {},
		},
	};
}

function persistedState({ preset, theme, marked }) {
	const presets = Object.fromEntries(
		Object.entries(defaultProjections).map(([id, projection]) => [
			id,
			emptyProgress(projection),
		]),
	);
	presets[preset].selected = Object.fromEntries(
		marked.map((id, index) => [
			id,
			{
				selectedAt: new Date(Date.UTC(2026, 0, 1 + index)).toISOString(),
				order: index + 1,
				stamp: ORIGIN_STAMP,
			},
		]),
	);
	return {
		schemaVersion: 2,
		activePresetId: preset,
		themePreference: theme,
		presets,
		stamps: { activePresetId: ORIGIN_STAMP, themePreference: ORIGIN_STAMP },
	};
}

const baseUrl = process.env.ATLAS_SCREENSHOT_URL ?? "http://127.0.0.1:3001";

const browser = await chromium.launch();
try {
	const context = await browser.newContext({
		// The workspace needs its supported viewport to mount at all; the card is clipped from it.
		viewport: { width: 1440, height: 900 },
		deviceScaleFactor: 2,
		colorScheme: "dark",
	});
	const page = await context.newPage();

	await page.goto(baseUrl);
	await page.evaluate(
		({ key, state }) => {
			localStorage.clear();
			localStorage.setItem(key, JSON.stringify(state));
		},
		{ key: STORAGE_KEY, state: persistedState(seed) },
	);
	await page.goto(baseUrl);
	await page.getByRole("heading", { name: "World sovereign states" }).waitFor();
	await page.getByTestId("atlas-map").waitFor();
	await page.waitForTimeout(900);

	await mkdir(outputDirectory, { recursive: true });
	await page.screenshot({
		path: join(outputDirectory, "social-card.png"),
		clip: { x: 0, y: 0, ...card },
		scale: "css",
	});
	console.log(`wrote social-card.png at ${card.width}x${card.height}`);
} finally {
	await browser.close();
}
