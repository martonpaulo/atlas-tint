import { createFileRoute } from "@tanstack/react-router";

import { AtlasApp } from "@/features/atlas/components/atlas-app";
import { ViewportGate } from "@/features/atlas/components/viewport-gate";

export const Route = createFileRoute("/")({
	component: HomeComponent,
});

function HomeComponent() {
	return (
		<ViewportGate>
			<AtlasApp />
		</ViewportGate>
	);
}
