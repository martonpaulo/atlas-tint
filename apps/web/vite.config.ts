import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin, type ResolvedConfig } from "vite";

/*
 * The faces the first paint actually needs: the Figtree the interface is set in and the
 * Source Serif 4 the titles are set in. Gabarito is declared as the fleet display face but
 * no element asks for it today, so preloading it would cost 20 KB and a console warning.
 *
 * Vite hashes the woff2 files out of the stylesheet and writes no preload link for them,
 * so the link tags are built from the finished bundle, where the hashed names are known.
 */
const preloadedFonts = [
	/^figtree-latin-(?:400|600)-normal-/,
	/^source-serif-4-latin-wght-normal-/,
];

function preloadFontAssets(): Plugin {
	let base = "/";
	return {
		name: "atlas-tint:preload-font-assets",
		apply: "build",
		configResolved(config: ResolvedConfig) {
			base = config.base;
		},
		transformIndexHtml: {
			order: "post",
			handler(_html, context) {
				const files = Object.keys(context.bundle ?? {}).filter((file) => {
					const name = file.split("/").pop() ?? file;
					return (
						name.endsWith(".woff2") &&
						preloadedFonts.some((pattern) => pattern.test(name))
					);
				});
				return files.sort().map((file) => ({
					tag: "link",
					attrs: {
						rel: "preload",
						as: "font",
						type: "font/woff2",
						crossorigin: "",
						href: `${base}${file}`,
					},
					injectTo: "head-prepend" as const,
				}));
			},
		},
	};
}

export default defineConfig({
	base: process.env.VITE_BASE_PATH ?? "/",
	server: {
		port: 3001,
	},
	resolve: {
		tsconfigPaths: true,
	},
	plugins: [
		tailwindcss(),
		preloadFontAssets(),
		tanstackRouter({
			target: "react",
			autoCodeSplitting: true,
		}),
		react(),
	],
});
