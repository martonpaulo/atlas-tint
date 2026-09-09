import { Toaster } from "@atlas-tint/ui/components/sonner";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { AppearanceBridge, useAppearance } from "@/components/appearance";

import "../index.css";

export type RouterAppContext = Record<never, never>;

export const Route = createRootRouteWithContext<RouterAppContext>()({
	component: RootComponent,
});

function RootComponent() {
	const appearance = useAppearance();
	return (
		<>
			<AppearanceBridge />
			<Outlet />
			<Toaster richColors theme={appearance} />
		</>
	);
}
