import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { chromium } from "@playwright/test";

/**
 * Capture the real application window, with the shadow, rounded corners, and elevation macOS
 * draws around it.
 *
 * Rendering the page offscreen is not equivalent: an offscreen bitmap has no window chrome, no
 * shadow, and no material, and raising the scale factor does not put them back. So this launches
 * a headed browser, waits for it to be genuinely on screen and active, resolves its window id
 * from its own process id rather than guessing among the windows on the desktop, and hands that
 * id to `screencapture -l`.
 *
 * Everything that would otherwise depend on this machine is pinned: window size, viewport,
 * theme, preset, and the seeded progress. Two people on two Macs get the same picture.
 */

const repositoryRoot = resolve(import.meta.dirname, "../..");
const outputDirectory = join(repositoryRoot, "docs/screenshots");
const helperDirectory = join(repositoryRoot, ".build/screenshots");

/** Fixed so the capture is reproducible, and 2x this is the widest we publish. */
const windowSize = { width: 1440, height: 900 };

const shots = [
	{
		name: "world",
		title: "World sovereign states",
		seed: {
			preset: "world",
			theme: "light",
			marked: ["world-br", "world-pt", "world-jp", "world-au", "world-ca"],
		},
	},
	{
		name: "spain",
		title: "Spanish provinces and autonomous cities",
		seed: {
			preset: "spain",
			theme: "light",
			marked: ["es-28", "es-08", "es-46", "es-35", "es-51"],
		},
	},
];

function run(command, commandArguments, options = {}) {
	const result = spawnSync(command, commandArguments, {
		encoding: "utf8",
		...options,
	});
	if (result.status !== 0)
		throw new Error(
			`${command} ${commandArguments.join(" ")} failed: ${result.stderr || result.stdout}`,
		);
	return result.stdout.trim();
}

async function buildHelpers() {
	await mkdir(helperDirectory, { recursive: true });
	for (const helper of ["window-id", "display-scale"]) {
		run("swiftc", [
			"-O",
			"-o",
			join(helperDirectory, helper),
			join(import.meta.dirname, `${helper}.swift`),
		]);
	}
}

function requireRetina() {
	const scale = Number(run(join(helperDirectory, "display-scale"), []));
	if (scale >= 2) return scale;
	if (process.argv.includes("--allow-low-dpi")) {
		console.warn(
			`Capturing on a ${scale}x display; the result is half resolution and must not be published.`,
		);
		return scale;
	}
	throw new Error(
		`The capture display reports a ${scale}x backing scale. A capture inherits its display's scale, so this would silently produce half-resolution images. Move the window to a Retina display and run again, or pass --allow-low-dpi for a throwaway capture.`,
	);
}

async function capture() {
	await buildHelpers();
	const scale = requireRetina();
	await rm(outputDirectory, { recursive: true, force: true });
	await mkdir(outputDirectory, { recursive: true });

	// An app-mode window (--app) has a title bar and nothing else: no tab strip, no address
	// bar, so no localhost URL ends up in a published image. That needs a persistent context,
	// which Playwright starts as a direct child of this process, so the browser's pid is found
	// among this process's children and never guessed from the desktop.
	// The page is seeded in Light, and the window frame (title bar, traffic lights) has to
	// match, or a light page sits in a dark window whenever the operator's Mac runs in Dark
	// Mode. Chromium's frame follows AppKit, so the test browser's own defaults domain gets
	// NSRequiresAquaSystemAppearance for the length of the run and loses it afterwards. It is
	// Playwright's browser, not the operator's: nothing outside this capture changes.
	const browserDomain = run("/usr/libexec/PlistBuddy", [
		"-c",
		"Print :CFBundleIdentifier",
		join(
			chromium.executablePath().replace(/\/Contents\/MacOS\/.*$/, ""),
			"Contents/Info.plist",
		),
	]);
	run("defaults", [
		"write",
		browserDomain,
		"NSRequiresAquaSystemAppearance",
		"-bool",
		"YES",
	]);
	const profile = await mkdtemp(join(tmpdir(), "atlas-tint-capture-"));
	const context = await chromium.launchPersistentContext(profile, {
		headless: false,
		viewport: null,
		args: [
			`--app=${baseUrl()}/`,
			`--window-size=${windowSize.width},${windowSize.height}`,
			"--window-position=80,80",
			// No first-run bubbles, infobars, or restore prompts in the picture.
			"--no-first-run",
			"--no-default-browser-check",
			"--disable-infobars",
			"--hide-crash-restore-bubble",
		],
	});
	const pid = Number(run("pgrep", ["-P", String(process.pid)]).split("\n")[0]);
	if (!pid) throw new Error("Could not determine the browser process id");
	const page = context.pages()[0] ?? (await context.newPage());

	try {
		for (const shot of shots) {
			// Seed through the storage key the application already owns, so the capture needs no
			// hook in production code and reproduces a state a user could really be in.
			await page.goto(`${baseUrl()}/`);
			await page.evaluate(
				({ key, state }) => {
					localStorage.clear();
					localStorage.setItem(key, JSON.stringify(state));
				},
				{ key: STORAGE_KEY, state: persistedState(shot.seed) },
			);
			await page.goto(`${baseUrl()}/`);
			await page.getByRole("heading", { name: shot.title }).waitFor();
			await page.getByTestId("atlas-map").waitFor();

			// The title bar keeps its traffic lights and loses its words: the product's name is
			// already on the page, the card and the README, and a second copy in the chrome is
			// noise. An empty title would make Chromium show the address instead, so the title
			// becomes a zero-width space for the capture only; the site itself is untouched.
			await page.evaluate(() => {
				document.title = "\u200B";
			});

			// Let a few run loops pass, then bring the window forward again: a window captured
			// while inactive comes out with a grey traffic light and dimmed controls.
			await page.waitForTimeout(600);
			await page.bringToFront();
			await page.waitForTimeout(400);

			const windowId = run(join(helperDirectory, "window-id"), [String(pid)]);
			const target = join(outputDirectory, `${shot.name}.png`);
			// No -o: that is the flag that removes the shadow.
			run("screencapture", ["-x", `-l${windowId}`, target]);
			// The capture is at display scale (2x). The README shows these at most 720 CSS px
			// wide, so anything past twice that is pixels nobody sees: publish at half the capture,
			// which is exactly the window's own point width (shadow included). Near-lossless keeps
			// every pixel within a few levels, so text edges stay identical, at about half the
			// bytes a lossless resample costs.
			const capturedWidth = Number(
				run("sips", ["-g", "pixelWidth", target]).match(/pixelWidth: (\d+)/)[1],
			);
			run("sips", [
				"--resampleWidth",
				String(Math.round(capturedWidth / scale)),
				target,
			]);
			run("cwebp", [
				"-near_lossless",
				"60",
				"-z",
				"9",
				"-metadata",
				"none",
				target,
				"-o",
				target.replace(/\.png$/, ".webp"),
			]);
			await rm(target);
			console.log(`captured ${shot.name} at ${scale}x`);
		}
	} finally {
		await context.close();
		await rm(profile, { recursive: true, force: true });
		run("defaults", [
			"delete",
			browserDomain,
			"NSRequiresAquaSystemAppearance",
		]);
	}
}

function baseUrl() {
	return process.env.ATLAS_SCREENSHOT_URL ?? "http://localhost:3001";
}

const STORAGE_KEY = "atlas-tint:state";
const SCHEMA_VERSION = 2;
/** Everything seeded is "already there", so nothing outranks a later edit by a real user. */
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
		schemaVersion: SCHEMA_VERSION,
		activePresetId: preset,
		themePreference: theme,
		presets,
		stamps: {
			activePresetId: ORIGIN_STAMP,
			themePreference: ORIGIN_STAMP,
		},
	};
}

await capture();
