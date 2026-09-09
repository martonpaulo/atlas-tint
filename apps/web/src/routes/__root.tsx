import { Toaster } from "@atlas-tint/ui/components/sonner";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
} from "@tanstack/react-router";
import { AppearanceBridge, useAppearance } from "@/components/appearance";
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
	const appearance = useAppearance();
	return (
		<>
			<HeadContent />
			<AppearanceBridge />
			<Outlet />
			<Toaster richColors theme={appearance} />
		</>
	);
}
