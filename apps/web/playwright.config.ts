import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: false,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 2 : 0,
	reporter: [
		["list"],
		[
			"html",
			{ outputFolder: "../../artifacts/playwright/report", open: "never" },
		],
	],
	outputDir: "../../artifacts/playwright/results",
	use: {
		baseURL: "http://127.0.0.1:3001",
		viewport: { width: 1440, height: 900 },
		colorScheme: "light",
		locale: "en-US",
		trace: "on-first-retry",
		screenshot: "only-on-failure",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	webServer: {
		command: "pnpm dev --host 127.0.0.1",
		cwd: import.meta.dirname,
		url: "http://127.0.0.1:3001",
		reuseExistingServer: false,
		timeout: 120_000,
	},
});
