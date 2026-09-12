import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Half the cores, never fewer than two.
 *
 * The component tests mount the whole world sidebar — roughly 250 regions, 485 controls — and
 * every Testing Library query by accessible name walks that tree in jsdom. Each test is therefore
 * about a second of real CPU, not a few milliseconds. Running one worker per core on top of that
 * does not just share the machine, it loses work to it: measured on eight cores, eight workers
 * spend 39s of test time to finish in 12.3s, while four spend 26s to finish in 11.6s — faster
 * wall clock for a third less CPU. The cost of the oversubscription lands on the slowest test,
 * which goes from 1.9s at four workers to 3.6s at eight, leaving no room under the 5s timeout and
 * making the suite fail differently on every run depending on what else the machine is doing.
 */
const maxWorkers = Math.max(2, Math.floor(availableParallelism() / 2));

export default defineConfig({
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
			"@atlas-tint/ui": fileURLToPath(
				new URL("../../packages/ui/src", import.meta.url),
			),
		},
	},
	test: {
		environment: "jsdom",
		setupFiles: ["./src/test/setup.ts"],
		include: ["src/**/*.test.{ts,tsx}"],
		maxWorkers,
		coverage: {
			reporter: ["text", "html"],
			reportsDirectory: "../../artifacts/coverage",
		},
	},
});
