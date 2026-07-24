import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

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
		coverage: {
			reporter: ["text", "html"],
			reportsDirectory: "../../artifacts/coverage",
		},
	},
});
