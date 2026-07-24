import { Toaster } from "@atlas-tint/ui/components/sonner";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
} from "@tanstack/react-router";
import { ThemeProvider } from "@/components/theme-provider";
import { publicAssetUrl } from "@/lib/public-asset-url";

import "../index.css";

export type RouterAppContext = Record<never, never>;

export const Route = createRootRouteWithContext<RouterAppContext>()({
	component: RootComponent,
	head: () => ({
		meta: [
			{
				title: "AtlasTint — local interactive atlas",
			},
			{
				name: "description",
				content:
					"A private, local-first interactive SVG atlas for tracking geographic progress.",
			},
		],
		links: [
			{
				rel: "icon",
				href: publicAssetUrl("favicon.svg"),
				type: "image/svg+xml",
			},
		],
	}),
});

function RootComponent() {
	return (
		<>
			<HeadContent />
			<ThemeProvider
				attribute="class"
				defaultTheme="system"
				disableTransitionOnChange
				storageKey="atlas-tint:theme"
			>
				<Outlet />
				<Toaster richColors />
			</ThemeProvider>
		</>
	);
}
