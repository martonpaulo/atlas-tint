import { useEffect } from "react";

import { AtlasApp } from "@/features/atlas/components/atlas-app";
import { ViewportGate } from "@/features/atlas/components/viewport-gate";
import { useAtlasStore } from "@/features/atlas/store";

/**
 * Owns durable state for the lifetime of the application.
 *
 * Viewport support decides what is rendered, never who owns persistence. Hydrating inside the
 * gate meant a resize across 1024 × 700 unmounted the workspace and re-read storage over
 * whatever the user had just done, so a selection made within the debounce window — or any
 * progress in a session that cannot write at all — disappeared on the way back.
 */
export function AtlasWorkspace() {
	const initialize = useAtlasStore(({ initialize: start }) => start);

	useEffect(() => initialize(), [initialize]);

	return (
		<ViewportGate>
			<AtlasApp />
		</ViewportGate>
	);
}
