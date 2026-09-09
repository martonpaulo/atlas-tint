import { createFileRoute } from "@tanstack/react-router";

import { AtlasWorkspace } from "@/features/atlas/components/atlas-workspace";

export const Route = createFileRoute("/")({
	component: HomeComponent,
});

function HomeComponent() {
	return <AtlasWorkspace />;
}
