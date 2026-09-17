import { Toaster } from "@atlastint/ui/components/sonner";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

import "../index.css";

export type RouterAppContext = Record<never, never>;

export const Route = createRootRouteWithContext<RouterAppContext>()({
	component: RootComponent,
});

function RootComponent() {
	return (
		<>
			<Outlet />
			<Toaster richColors theme="light" />
		</>
	);
}
